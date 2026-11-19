import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPrivateKey,
  hkdfSync,
  randomBytes,
  sign,
  timingSafeEqual,
} from "crypto"

import { cleanName, personId, VALID } from "@/lib/people"
import { get, memoryStore, put } from "@/lib/store"

// Signing in with an account people already have: Google, Apple, Facebook or Microsoft. Each is
// the plain OAuth code flow, done on the server with nothing but Node's crypto, so no script from
// any of them ever loads on the site. Only a name is asked for, never an email address.
//
// A provider's account is linked to a person the way a passkey is: the link holds the person's
// cookie (encrypted, so the store alone can't sign anyone in), and signing in hands that cookie
// back. There is no table of accounts.

export type Provider = "google" | "apple" | "facebook" | "microsoft" | "test"

export const PROVIDERS: Provider[] = [
  "google",
  "apple",
  "facebook",
  "microsoft",
]

export const LABEL: Record<Provider, string> = {
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
  microsoft: "Microsoft",
  test: "Test",
}

const env = (name: string) => process.env[name]?.trim() || ""

// The key that signs the short-lived sign-in cookies and seals the cookie kept in each link:
// TN_AUTH_KEY when it is set, otherwise one drawn from the store's own token, so the site needs no
// extra secret. The test suite's server has a fixed one of its own.
function secret(): Buffer | null {
  if (memoryStore) return createHash("sha256").update("tn-test-auth").digest()
  const raw = env("TN_AUTH_KEY")
  if (raw) {
    const key = Buffer.from(raw, "base64")
    return key.length >= 32 ? key.subarray(0, 32) : null
  }
  const store = env("BLOB_READ_WRITE_TOKEN")
  return store
    ? Buffer.from(hkdfSync("sha256", store, "thennow", "tn-auth-v1", 32))
    : null
}

export function isConfigured(provider: Provider): boolean {
  if (!secret()) return false
  switch (provider) {
    case "google":
      return !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"))
    case "apple":
      return !!(
        env("APPLE_CLIENT_ID") &&
        env("APPLE_TEAM_ID") &&
        env("APPLE_KEY_ID") &&
        env("APPLE_PRIVATE_KEY")
      )
    case "facebook":
      return !!(env("FACEBOOK_APP_ID") && env("FACEBOOK_APP_SECRET"))
    case "microsoft":
      return !!(env("MICROSOFT_CLIENT_ID") && env("MICROSOFT_CLIENT_SECRET"))
    case "test":
      // A pretend provider that signs anyone in, for the test suite's own server only.
      return memoryStore
  }
}

export const configured = (): Provider[] => [
  ...PROVIDERS.filter(isConfigured),
  ...(memoryStore ? (["test"] as Provider[]) : []),
]

export function asProvider(raw: string): Provider | null {
  return (PROVIDERS as string[]).includes(raw) || raw === "test"
    ? (raw as Provider)
    : null
}

// ---- Small signed cookies ------------------------------------------------------------------

const b64 = (data: Buffer | string) => Buffer.from(data).toString("base64url")

function seal(value: unknown, maxAgeSec: number): string {
  const key = secret()
  if (!key) throw new Error("no auth key")
  const body = b64(
    JSON.stringify({ v: value, e: Date.now() + maxAgeSec * 1000 })
  )
  const mac = b64(createHmac("sha256", key).update(body).digest())
  return `${body}.${mac}`
}

function unseal<T>(token: string | null): T | null {
  const key = secret()
  if (!key || !token) return null
  const [body, mac] = token.split(".")
  if (!body || !mac) return null
  const want = createHmac("sha256", key).update(body).digest()
  const got = Buffer.from(mac, "base64url")
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  try {
    const found = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
    return typeof found?.e === "number" && Date.now() < found.e
      ? (found.v as T)
      : null
  } catch {
    return null
  }
}

function readCookieNamed(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? ""
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=")
    if (key === name) return rest.join("=")
  }
  return null
}

const isSecure = (request: Request) =>
  new URL(request.url).protocol === "https:"

// The trip out to a provider: which one, what it must say back, and where to return.
const TRIP = "tn_oa"
// What the provider said, carried for a moment to the step that signs this browser in.
const LANDED = "tn_ok"

type Trip = { p: Provider; s: string; v: string; n: string; b: string }
export type Landed = {
  p: Provider
  sub: string
  name: string | null
  b: string
}

// Apple answers with a form posted from its own site, which only carries a cookie marked
// SameSite=None. That needs Secure, which plain-http localhost can't have; tests use Lax there.
function tripCookie(value: string, request: Request, maxAge: number) {
  const same = isSecure(request) ? "SameSite=None; Secure" : "SameSite=Lax"
  return `${TRIP}=${value}; Path=/api/auth; Max-Age=${maxAge}; HttpOnly; ${same}`
}

function landedCookie(value: string, request: Request, maxAge: number) {
  const secure = isSecure(request) ? "; Secure" : ""
  return `${LANDED}=${value}; Path=/api/auth; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`
}

// Only a path on this site, never another site's address.
export function safeBack(raw: string | null | undefined): string {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\")
  )
    return "/me"
  return raw.slice(0, 500)
}

// The address the browser used. Next may name a local server by another host than the one
// asked for (localhost for 127.0.0.1), so the Host header decides; a provider only accepts the
// return addresses registered with it anyway.
export function originOf(request: Request) {
  const url = new URL(request.url)
  const host = request.headers.get("host")
  return host && /^[a-z0-9.-]+(:\d+)?$/i.test(host)
    ? `${url.protocol}//${host}`
    : url.origin
}

const callbackUrl = (request: Request, provider: Provider) =>
  `${originOf(request)}/api/auth/${provider}/callback`

const challengeOf = (verifier: string) =>
  b64(createHash("sha256").update(verifier).digest())

// ---- Out to the provider -------------------------------------------------------------------

export function startUrl(request: Request, provider: Provider, back: string) {
  const trip: Trip = {
    p: provider,
    s: b64(randomBytes(18)),
    v: b64(randomBytes(32)),
    n: b64(randomBytes(18)),
    b: safeBack(back),
  }
  const redirect = callbackUrl(request, provider)
  let url: URL
  switch (provider) {
    case "google":
      url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
      url.search = new URLSearchParams({
        client_id: env("GOOGLE_CLIENT_ID"),
        redirect_uri: redirect,
        response_type: "code",
        scope: "openid profile",
        state: trip.s,
        nonce: trip.n,
        code_challenge: challengeOf(trip.v),
        code_challenge_method: "S256",
        prompt: "select_account",
      }).toString()
      break
    case "microsoft":
      url = new URL(
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
      )
      url.search = new URLSearchParams({
        client_id: env("MICROSOFT_CLIENT_ID"),
        redirect_uri: redirect,
        response_type: "code",
        response_mode: "query",
        scope: "openid profile",
        state: trip.s,
        nonce: trip.n,
        code_challenge: challengeOf(trip.v),
        code_challenge_method: "S256",
        prompt: "select_account",
      }).toString()
      break
    case "apple":
      url = new URL("https://appleid.apple.com/auth/authorize")
      url.search = new URLSearchParams({
        client_id: env("APPLE_CLIENT_ID"),
        redirect_uri: redirect,
        response_type: "code",
        response_mode: "form_post",
        scope: "name",
        state: trip.s,
        nonce: trip.n,
      }).toString()
      break
    case "facebook":
      url = new URL("https://www.facebook.com/v25.0/dialog/oauth")
      url.search = new URLSearchParams({
        client_id: env("FACEBOOK_APP_ID"),
        redirect_uri: redirect,
        response_type: "code",
        scope: "public_profile",
        state: trip.s,
      }).toString()
      break
    case "test":
      url = new URL(`${originOf(request)}/api/auth/test/callback`)
      url.search = new URLSearchParams({
        state: trip.s,
        code:
          new URL(request.url).searchParams.get("as") ??
          `visitor-${randomBytes(9).toString("hex")}`,
      }).toString()
      break
  }
  return {
    url: url.toString(),
    cookie: tripCookie(seal(trip, 600), request, 600),
  }
}

// ---- Back from the provider ----------------------------------------------------------------

type Claims = Record<string, unknown>

// The ID token comes straight from the provider's token endpoint over TLS, in answer to this
// site's own secret, so its signature need not be checked again (OpenID Connect Core 3.1.3.7);
// who issued it, for whom, until when and in answer to which trip are.
function claimsOf(idToken: unknown): Claims | null {
  if (typeof idToken !== "string") return null
  const part = idToken.split(".")[1]
  if (!part) return null
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"))
  } catch {
    return null
  }
}

function checked(
  claims: Claims | null,
  issuer: (iss: string) => boolean,
  audience: string,
  nonce: string
) {
  if (!claims) return null
  const aud = claims.aud
  const audOk = Array.isArray(aud) ? aud.includes(audience) : aud === audience
  const now = Date.now() / 1000
  if (
    typeof claims.iss !== "string" ||
    !issuer(claims.iss) ||
    !audOk ||
    typeof claims.exp !== "number" ||
    claims.exp < now - 60 ||
    claims.nonce !== nonce ||
    typeof claims.sub !== "string" ||
    !claims.sub
  )
    return null
  return claims as Claims & { sub: string }
}

async function postForm(url: string, form: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`token ${response.status}`)
  return response.json()
}

// Apple's client secret is a short JWT signed with the site's Apple key.
function appleSecret() {
  const header = b64(
    JSON.stringify({ alg: "ES256", kid: env("APPLE_KEY_ID"), typ: "JWT" })
  )
  const now = Math.floor(Date.now() / 1000)
  const payload = b64(
    JSON.stringify({
      iss: env("APPLE_TEAM_ID"),
      iat: now,
      exp: now + 300,
      aud: "https://appleid.apple.com",
      sub: env("APPLE_CLIENT_ID"),
    })
  )
  const key = createPrivateKey(env("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n"))
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key,
    dsaEncoding: "ieee-p1363",
  })
  return `${header}.${payload}.${b64(signature)}`
}

function appleName(raw: string | null) {
  if (!raw) return null
  try {
    const user = JSON.parse(raw)
    return cleanName(
      [user?.name?.firstName, user?.name?.lastName].filter(Boolean).join(" ")
    )
  } catch {
    return null
  }
}

// Who the provider says this is, or null. Throws only when a provider can't be reached.
async function identify(
  request: Request,
  trip: Trip,
  code: string,
  form: URLSearchParams | null
): Promise<{ sub: string; name: string | null } | null> {
  const redirect = callbackUrl(request, trip.p)
  switch (trip.p) {
    case "google": {
      const token = await postForm("https://oauth2.googleapis.com/token", {
        code,
        client_id: env("GOOGLE_CLIENT_ID"),
        client_secret: env("GOOGLE_CLIENT_SECRET"),
        redirect_uri: redirect,
        grant_type: "authorization_code",
        code_verifier: trip.v,
      })
      const claims = checked(
        claimsOf(token.id_token),
        (iss) =>
          iss === "https://accounts.google.com" ||
          iss === "accounts.google.com",
        env("GOOGLE_CLIENT_ID"),
        trip.n
      )
      return claims ? { sub: claims.sub, name: cleanName(claims.name) } : null
    }
    case "microsoft": {
      const token = await postForm(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        {
          code,
          client_id: env("MICROSOFT_CLIENT_ID"),
          client_secret: env("MICROSOFT_CLIENT_SECRET"),
          redirect_uri: redirect,
          grant_type: "authorization_code",
          code_verifier: trip.v,
          scope: "openid profile",
        }
      )
      const claims = checked(
        claimsOf(token.id_token),
        (iss) =>
          /^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]{36}\/v2\.0$/.test(
            iss
          ),
        env("MICROSOFT_CLIENT_ID"),
        trip.n
      )
      // A Microsoft subject is only unique within its tenant.
      return claims
        ? {
            sub: `${String(claims.tid ?? "")}:${claims.sub}`,
            name: cleanName(claims.name),
          }
        : null
    }
    case "apple": {
      const token = await postForm("https://appleid.apple.com/auth/token", {
        code,
        client_id: env("APPLE_CLIENT_ID"),
        client_secret: appleSecret(),
        redirect_uri: redirect,
        grant_type: "authorization_code",
      })
      const claims = checked(
        claimsOf(token.id_token),
        (iss) => iss === "https://appleid.apple.com",
        env("APPLE_CLIENT_ID"),
        trip.n
      )
      // Apple gives the name once, the first time someone allows the site.
      return claims
        ? { sub: claims.sub, name: appleName(form?.get("user") ?? null) }
        : null
    }
    case "facebook": {
      const exchange = new URL(
        "https://graph.facebook.com/v25.0/oauth/access_token"
      )
      exchange.search = new URLSearchParams({
        client_id: env("FACEBOOK_APP_ID"),
        client_secret: env("FACEBOOK_APP_SECRET"),
        redirect_uri: redirect,
        code,
      }).toString()
      const token = await (
        await fetch(exchange, { signal: AbortSignal.timeout(10_000) })
      ).json()
      if (typeof token?.access_token !== "string") return null
      const proof = createHmac("sha256", env("FACEBOOK_APP_SECRET"))
        .update(token.access_token)
        .digest("hex")
      const me = new URL("https://graph.facebook.com/v25.0/me")
      me.search = new URLSearchParams({
        fields: "id,name",
        access_token: token.access_token,
        appsecret_proof: proof,
      }).toString()
      const found = await (
        await fetch(me, { signal: AbortSignal.timeout(10_000) })
      ).json()
      return typeof found?.id === "string" && found.id
        ? { sub: found.id, name: cleanName(found.name) }
        : null
    }
    case "test": {
      // "as" is "subject" or "subject:Name".
      const [sub, ...name] = code.split(":")
      return /^[a-z0-9-]{1,64}$/i.test(sub)
        ? { sub, name: cleanName(name.join(":")) }
        : null
    }
  }
}

export type Back =
  | { ok: true; url: string; cookies: string[] }
  | { ok: false; url: string; cookies: string[] }

// The provider's answer, checked against the trip this same browser started. Either way the
// browser goes on to a page of this site, with the trip cookie cleared.
export async function land(
  request: Request,
  provider: Provider
): Promise<Back> {
  const url = new URL(request.url)
  const form =
    request.method === "POST"
      ? new URLSearchParams(await request.text().catch(() => ""))
      : null
  const param = (name: string) =>
    form?.get(name) ?? url.searchParams.get(name) ?? null
  const trip = unseal<Trip>(readCookieNamed(request, TRIP))
  const clear = tripCookie("", request, 0)
  const origin = originOf(request)
  if (!trip || trip.p !== provider)
    return { ok: false, url: `${origin}/me#signin-failed`, cookies: [clear] }
  const back = `${origin}${trip.b}`
  const failed = {
    ok: false as const,
    url: `${back}#signin-failed`,
    cookies: [clear],
  }
  const state = param("state") ?? ""
  if (
    state.length !== trip.s.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(trip.s))
  )
    return failed
  // Turning the provider down is an answer, not a failure: back to where they were.
  const error = param("error")
  if (error)
    return {
      ok: false,
      url: /denied|cancel/i.test(error) ? back : `${back}#signin-failed`,
      cookies: [clear],
    }
  const code = param("code")
  if (!code) return failed
  try {
    const who = await identify(request, trip, code, form)
    if (!who) return failed
    const landed: Landed = {
      p: provider,
      sub: who.sub,
      name: who.name,
      b: trip.b,
    }
    return {
      ok: true,
      url: `${origin}/api/auth/done`,
      cookies: [clear, landedCookie(seal(landed, 120), request, 120)],
    }
  } catch (error) {
    console.error(`sign in ${provider} failed ${String(error).slice(0, 300)}`)
    return failed
  }
}

export function takeLanded(request: Request) {
  return {
    landed: unseal<Landed>(readCookieNamed(request, LANDED)),
    clear: landedCookie("", request, 0),
  }
}

// ---- Links between a provider's account and a person --------------------------------------

const linkPath = (provider: Provider, sub: string) =>
  `links/${provider}/${createHash("sha256").update(`${provider}:${sub}`).digest("hex").slice(0, 32)}.json`

function encrypt(cookie: string) {
  const key = secret()!
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const body = Buffer.concat([cipher.update(cookie, "utf8"), cipher.final()])
  return b64(Buffer.concat([iv, cipher.getAuthTag(), body]))
}

function decrypt(sealed: string): string | null {
  const key = secret()
  if (!key) return null
  try {
    const raw = Buffer.from(sealed, "base64url")
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    const cookie = Buffer.concat([
      decipher.update(raw.subarray(28)),
      decipher.final(),
    ]).toString("utf8")
    return VALID.test(cookie) ? cookie : null
  } catch {
    return null
  }
}

// The cookie of the person this account belongs to, if it is linked.
export async function linkedCookie(provider: Provider, sub: string) {
  const found = await get(linkPath(provider, sub), {
    access: "private",
    useCache: false,
  })
  if (!found || found.statusCode !== 200) return null
  const link = JSON.parse(await new Response(found.stream).text())
  const cookie = typeof link?.c === "string" ? decrypt(link.c) : null
  return cookie && link.id === personId(cookie) ? cookie : null
}

// A link that can no longer be read (its key changed) may be written over; any other is kept.
export async function link(
  provider: Provider,
  sub: string,
  cookie: string,
  overwrite = false
) {
  await put(
    linkPath(provider, sub),
    JSON.stringify({ id: personId(cookie), c: encrypt(cookie) }),
    {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: overwrite,
    }
  )
}

export async function hasLink(provider: Provider, sub: string) {
  const found = await get(linkPath(provider, sub), {
    access: "private",
    useCache: false,
  })
  return !!found && found.statusCode === 200
}
