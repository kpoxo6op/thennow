import { createHash, randomBytes } from "crypto"
import { del, get, hasStore, list, put, rename } from "@/lib/store"

// The people who send photos. A browser gets a random cookie the first time it reaches the
// camera's review or signs up; the photos it sends are kept together under that cookie, so its
// owner can sign up with a name before or after sending. Signing up also saves a passkey
// (lib/passkey) that carries the cookie to their other devices. Nothing else identifies them.

export const COOKIE = "tn_me"
// Browsers keep a cookie for at most 400 days; each visit to the review renews it.
const MAX_AGE = 400 * 24 * 60 * 60

export const VALID = /^[A-Za-z0-9_-]{32}$/

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

export type Profile = { name: string; createdAt: string; updatedAt: string; passkey?: true }

// No profile is null; a store that can't be reached throws, so it isn't mistaken for no name.
export async function readProfile(id: string): Promise<Profile | null> {
  if (!hasStore()) return null
  const found = await get(profilePath(id), { access: "private", useCache: false })
  if (!found || found.statusCode !== 200) return null
  const profile = JSON.parse(await new Response(found.stream).text())
  return typeof profile?.name === "string" && profile.name ? profile : null
}

export async function writeProfile(id: string, change: { name?: string; passkey?: true }) {
  const now = new Date().toISOString()
  const before = await readProfile(id)
  const name = change.name ?? before?.name
  if (!name) return null
  const passkey = change.passkey ?? before?.passkey
  await put(
    profilePath(id),
    JSON.stringify({ name, createdAt: before?.createdAt ?? now, updatedAt: now, passkey }),
    {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      // Every read of a profile skips the cache (useCache: false), so this only bounds the CDN.
      cacheControlMaxAge: 60,
    }
  )
  return { name, passkey: !!passkey }
}

export async function removeProfile(id: string) {
  await del(profilePath(id))
}

const PRIVATE = { access: "private", addRandomSuffix: false, allowOverwrite: true } as const

// Files a small copy of a stored photo under the person who sent it.
export function filePhoto(id: string, place: string, key: string, small: Buffer) {
  return put(photoPath(id, place, key), small, { ...PRIVATE, contentType: "image/jpeg" })
}

// Points a stored photo's note at the person it now belongs to.
export async function followPhoto(place: string, key: string, id: string) {
  const pathname = `submissions/${place}/${key}.json`
  const found = await get(pathname, { access: "private", useCache: false })
  if (!found || found.statusCode !== 200) return
  const note = JSON.parse(await new Response(found.stream).text())
  if (note.by === id) return
  await put(pathname, JSON.stringify({ ...note, by: id }), {
    ...PRIVATE,
    contentType: "application/json",
  })
}

// Signing in on a browser that has already sent photos: they all join the person's others, a few
// at a time. The whole list is read before anything moves, so moving can't unsettle the listing.
// Each note moves before its photo, so a move that stops half-way is finished by signing in again.
const MOVED_AT_ONCE = 10

export async function movePhotos(from: string, to: string) {
  if (from === to) return
  const prefix = photosPrefix(from)
  const found: string[] = []
  let cursor: string | undefined
  do {
    const page = await list({ prefix, cursor, limit: 1000 })
    found.push(...page.blobs.map((blob) => blob.pathname))
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)

  for (let start = 0; start < found.length; start += MOVED_AT_ONCE) {
    await Promise.all(
      found.slice(start, start + MOVED_AT_ONCE).map(async (pathname) => {
        const [place, file] = pathname.slice(prefix.length).split("/")
        const key = file?.replace(/\.jpg$/, "")
        if (!place || !key) return
        await followPhoto(place, key, to)
        await rename(pathname, photoPath(to, place, key), {
          ...PRIVATE,
          contentType: "image/jpeg",
        })
      })
    )
  }
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
