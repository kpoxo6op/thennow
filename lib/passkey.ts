import { createHash } from "crypto"
import { get, put } from "@vercel/blob"
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server"

import { personId, VALID } from "@/lib/people"

// Signing up saves a passkey on the person's phone, which their phone keeps with its screen lock
// and carries to their other devices. The passkey holds the browser's cookie itself, so signing in
// anywhere simply hands that same cookie back: no email, no password, and no table of accounts.

const CHALLENGE = "tn_ch"

const site = (request: Request) => {
  const url = new URL(request.url)
  return { rpID: url.hostname, origin: url.origin }
}

// The question a passkey must answer is kept in a short-lived cookie between the two requests.
export function challengeHeader(challenge: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : ""
  const age = challenge ? 300 : 0
  return `${CHALLENGE}=${challenge}; Path=/api/me; Max-Age=${age}; HttpOnly; SameSite=Strict${secure}`
}

function readChallenge(request: Request) {
  const header = request.headers.get("cookie") ?? ""
  const found = header.split(";").find((part) => part.trim().startsWith(`${CHALLENGE}=`))
  const value = found?.trim().slice(CHALLENGE.length + 1) ?? ""
  return /^[A-Za-z0-9_-]{20,200}$/.test(value) ? value : null
}

type Stored = { id: string; publicKey: string; counter: number; transports?: string[] }

const keyPath = (credentialId: string) =>
  `keys/${createHash("sha256").update(credentialId).digest("hex").slice(0, 32)}.json`

export function signUpOptions(request: Request, cookie: string, name: string) {
  return generateRegistrationOptions({
    rpName: "then|now",
    rpID: site(request).rpID,
    userName: name,
    userID: new TextEncoder().encode(cookie),
    attestationType: "none",
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  })
}

// True once the passkey is stored for this cookie's person.
export async function finishSignUp(request: Request, cookie: string, response: RegistrationResponseJSON) {
  const challenge = readChallenge(request)
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
  await put(keyPath(credential.id), JSON.stringify(stored), {
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
export async function finishSignIn(request: Request, response: AuthenticationResponseJSON) {
  const challenge = readChallenge(request)
  if (!challenge || typeof response?.id !== "string") return null
  const handle = response.response?.userHandle
  if (typeof handle !== "string") return null
  const cookie = Buffer.from(handle, "base64url").toString("utf8")
  if (!VALID.test(cookie)) return null
  const found = await get(keyPath(response.id), { access: "private", useCache: false })
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
  return result?.verified ? cookie : null
}
