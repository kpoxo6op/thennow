import { createHash, randomBytes } from "crypto"
import { del, get, head, list, put } from "@vercel/blob"

// The people who send photos, without accounts. A phone's browser gets a random cookie the first
// time it reaches the camera's review; the photos it sends are kept together under that cookie, so
// whoever holds the phone can add a name to them, now or later. Nothing else identifies them.

export const COOKIE = "tn_me"
// Browsers keep a cookie for at most 400 days; each visit to the review renews it.
const MAX_AGE = 400 * 24 * 60 * 60

const VALID = /^[A-Za-z0-9_-]{32}$/

export function readCookie(request: Request): string | null {
  const header = request.headers.get("cookie") ?? ""
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name === COOKIE) {
      const value = rest.join("=")
      return VALID.test(value) ? value : null
    }
  }
  return null
}

export function newCookie() {
  return randomBytes(24).toString("base64url")
}

export function cookieHeader(value: string, secure: boolean) {
  return `${COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`
}

// Secure everywhere but plain-http localhost, where tests and development run.
export function isSecure(request: Request) {
  return new URL(request.url).protocol === "https:"
}

// The folder name for a phone's photos: the cookie itself never reaches the store.
export function personId(cookie: string) {
  return createHash("sha256").update(cookie).digest("hex").slice(0, 32)
}

export const profilePath = (id: string) => `people/${id}.json`
export const photosPrefix = (id: string) => `people/${id}/`
export const photoPath = (id: string, place: string, key: string) =>
  `people/${id}/${place}/${key}.jpg`

export type Profile = { name: string; createdAt: string; updatedAt: string }

export async function readProfile(id: string): Promise<Profile | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null
  try {
    const found = await get(profilePath(id), {
      access: "private",
      useCache: false,
    })
    if (!found || found.statusCode !== 200) return null
    const profile = JSON.parse(await new Response(found.stream).text())
    return typeof profile?.name === "string" && profile.name ? profile : null
  } catch {
    return null
  }
}

export async function writeProfile(id: string, name: string) {
  const now = new Date().toISOString()
  const before = await readProfile(id)
  await put(
    profilePath(id),
    JSON.stringify({ name, createdAt: before?.createdAt ?? now, updatedAt: now }),
    {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      // Every read of a profile skips the cache (useCache: false), so this only bounds the CDN.
      cacheControlMaxAge: 60,
    }
  )
}

export async function removeProfile(id: string) {
  await del(profilePath(id))
}

// Whether this phone has sent a photo. The photo just sent is checked directly, because a fresh
// photo can take a moment to show up in a listing.
export async function hasPhotos(id: string, sent?: { place: string; key: string }) {
  if (sent) {
    try {
      await head(photoPath(id, sent.place, sent.key))
      return true
    } catch {}
  }
  const { blobs } = await list({ prefix: photosPrefix(id), limit: 1 })
  return blobs.length > 0
}


const HIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu

// A name as someone would sign a photo: plain letters and spaces, nothing that hides or reorders
// text, at most 60 characters. Empty means no name.
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const name = raw.normalize("NFC").replace(HIDDEN, "").replace(/\s+/g, " ").trim()
  if (!name || [...name].length > 60) return null
  return name
}
