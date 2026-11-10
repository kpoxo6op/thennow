import { createHash } from "crypto"
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server"

import { personId, VALID } from "@/lib/people"
import { del, get, list, put } from "@/lib/store"

// Signing up saves a passkey on the person's phone, which their phone keeps with its screen lock
// and carries to their other devices. The passkey holds the browser's cookie itself, so signing in
// anywhere simply hands that same cookie back: no email, no password, and no table of accounts.

const CHALLENGE = "tn_ch"

const site = (request: Request) => {
  const url = new URL(request.url)
  return { rpID: url.hostname, origin: url.origin }
}

// The cookie only says which question a browser is answering; the store says whether the site asked it.
export function challengeHeader(challenge: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : ""
  const age = challenge ? 300 : 0
  return `${CHALLENGE}=${challenge}; Path=/api/me; Max-Age=${age}; HttpOnly; SameSite=Strict${secure}`
}

function readChallenge(request: Request) {
  const header = request.headers.get("cookie") ?? ""
  const found = header
    .split(";")
    .find((part) => part.trim().startsWith(`${CHALLENGE}=`))
  const value = found?.trim().slice(CHALLENGE.length + 1) ?? ""
  return /^[A-Za-z0-9_-]{20,200}$/.test(value) ? value : null
}

const ASKED_MS = 5 * 60_000

const askedPath = (challenge: string) =>
  `challenges/${createHash("sha256").update(challenge).digest("hex").slice(0, 32)}.json`

// Every question the site asks is noted in the store until it is answered or five minutes
// pass, so only a question the site itself asked, and has not yet heard an answer to, counts.
export async function rememberChallenge(challenge: string) {
  await put(
    askedPath(challenge),
    JSON.stringify({ until: Date.now() + ASKED_MS }),
    {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    }
  )
  // Now and then, questions nobody answered are cleared away.
  if (Math.random() < 0.05) await forgetOldChallenges().catch(() => {})
}

async function forgetOldChallenges() {
  const { blobs } = await list({ prefix: "challenges/", limit: 200 })
  const old = blobs
    .filter((blob) => Date.now() - blob.uploadedAt.getTime() > 2 * ASKED_MS)
    .map((blob) => blob.pathname)
  if (old.length) await del(old)
}

// The question this request answers, if the site asked it within five minutes and it has not
// been answered before. Looking uses it up, whatever the answer turns out to be.
async function takeChallenge(request: Request) {
  const challenge = readChallenge(request)
  if (!challenge) return null
  const path = askedPath(challenge)
  const found = await get(path, { access: "private", useCache: false })
  if (!found || found.statusCode !== 200) return null
  const asked = JSON.parse(await new Response(found.stream).text())
  await del(path)
  return typeof asked?.until === "number" && Date.now() < asked.until
    ? challenge
    : null
}

type Stored = {
  id: string
  publicKey: string
  counter: number
  transports?: string[]
}

const keyPath = (credentialId: string) =>
  `keys/${createHash("sha256").update(credentialId).digest("hex").slice(0, 32)}.json`

export function signUpOptions(request: Request, cookie: string, name: string) {
  return generateRegistrationOptions({
    rpName: "then|now",
    rpID: site(request).rpID,
    userName: name,
    userID: new TextEncoder().encode(cookie),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  })
}

// True once the passkey is stored for this cookie's person.
export async function finishSignUp(
  request: Request,
  cookie: string,
  response: RegistrationResponseJSON
) {
  const challenge = await takeChallenge(request)
  if (!challenge) return false
  const { rpID, origin } = site(request)
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  }).catch(() => null)
  if (!result?.verified) return false
  const { credential } = result.registrationInfo
  const stored: Stored = {
    id: personId(cookie),
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports,
  }
  const path = keyPath(credential.id)
  // A passkey already stored stays with the person who saved it. A sign-up isn't signed by the
  // passkey it names, so without this, anyone who learned a passkey's id could take its record
  // and lock its owner out.
  const kept = await get(path, { access: "private", useCache: false })
  if (kept && kept.statusCode === 200) {
    const owner: Stored = JSON.parse(await new Response(kept.stream).text())
    if (owner.id !== stored.id) return false
  }
  await put(path, JSON.stringify(stored), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return true
}

export function signInOptions(request: Request) {
  return generateAuthenticationOptions({
    rpID: site(request).rpID,
    userVerification: "preferred",
  })
}

// The cookie the passkey carries, once the passkey has proved itself; otherwise null.
export async function finishSignIn(
  request: Request,
  response: AuthenticationResponseJSON
) {
  const challenge = await takeChallenge(request)
  if (!challenge || typeof response?.id !== "string") return null
  const handle = response.response?.userHandle
  if (typeof handle !== "string") return null
  const cookie = Buffer.from(handle, "base64url").toString("utf8")
  if (!VALID.test(cookie)) return null
  const found = await get(keyPath(response.id), {
    access: "private",
    useCache: false,
  })
  if (!found || found.statusCode !== 200) return null
  const stored: Stored = JSON.parse(await new Response(found.stream).text())
  if (stored.id !== personId(cookie)) return null
  const { rpID, origin } = site(request)
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
    credential: {
      id: response.id,
      publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64url")),
      counter: stored.counter,
    },
  }).catch(() => null)
  if (!result?.verified) return null
  // How many times the passkey says it has been used is kept, so an older copy of it is refused.
  // A passkey that syncs between devices always says zero, and nothing is written for it.
  const { newCounter } = result.authenticationInfo
  if (newCounter > stored.counter) {
    await put(
      keyPath(response.id),
      JSON.stringify({ ...stored, counter: newCounter }),
      {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      }
    ).catch(() => {})
  }
  return cookie
}
