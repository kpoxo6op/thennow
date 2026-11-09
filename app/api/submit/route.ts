import { head, put } from "@vercel/blob"
import sharp from "sharp"

import { fetchPending, fetchPosts } from "@/lib/api"
import { limiter, sameSite } from "@/lib/limit"
import {
  cookieHeader,
  isSecure,
  newCookie,
  personId,
  photoPath,
  readCookie,
  readProfile,
} from "@/lib/people"

// Receives a photograph taken with the site's camera at one of its places and keeps it in the
// site's private photo store, where only the site's owner can see it. Nothing is published from
// here: a photo goes on the site only once the owner adds it by hand. No name, address or
// location is kept; the JPEG comes from a canvas, so it carries no camera or GPS details. Each
// photo is also filed, as a small copy, under the sending phone's random cookie (lib/people), so
// that phone can see its photos and add a name to them.

export const runtime = "nodejs"
export const maxDuration = 30

// Below Vercel's 4.5 MB request limit; the camera sends about 1-2 MB.
const MAX_BYTES = 4_000_000
// Generous: a walking group on one Wi-Fi or a shared mobile address all count as one.
const allowed = limiter(60, 60 * 60_000)

// A real, whole JPEG of camera size, drawn again from its pixels alone, so nothing else that
// rode along in the file (comments, metadata, trailing data) is kept.
async function clean(bytes: Uint8Array) {
  try {
    const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" })
    const meta = await image.metadata()
    if (meta.format !== "jpeg" || !meta.width || !meta.height) return null
    const [photo, small] = await Promise.all([
      image.clone().jpeg({ quality: 90 }).toBuffer(),
      image.clone().resize({ width: 480, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer(),
    ])
    return { photo, small }
  } catch {
    return null
  }
}

const answer = (status: number, error?: string) =>
  Response.json(error ? { error } : { ok: true }, { status })

export async function POST(request: Request) {
  if (!sameSite(request)) return answer(403, "forbidden")

  const url = new URL(request.url)
  const slug = url.searchParams.get("place") ?? ""
  // One key per shot, so a second tap or a retry after a lost answer keeps one copy.
  const key = url.searchParams.get("key") ?? ""
  const checked = url.searchParams.get("checked") === "1"
  if (!/^[a-z0-9]{12,40}$/.test(key)) return answer(400, "bad key")
  // Any place the camera opens for: an upcoming one, or a finished story worth retaking.
  const places = [...(await fetchPosts()), ...(await fetchPending())]
  if (!places.some((place) => place.slug === slug && !place.sample))
    return answer(404, "no such place")

  const length = Number(request.headers.get("content-length") ?? 0)
  if (length > MAX_BYTES) return answer(413, "too big")
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length > MAX_BYTES) return answer(413, "too big")
  const cleaned = await clean(bytes)
  if (!cleaned) return answer(415, "not a jpeg")
  const { photo, small } = cleaned

  if (!process.env.BLOB_READ_WRITE_TOKEN) return answer(503, "no store")
  // The review gives the phone its cookie before the send; one is made here only if that failed.
  const known = readCookie(request)
  const cookie = known ?? newCookie()
  const id = personId(cookie)
  const done = () => {
    const response = answer(200)
    if (!known) response.headers.set("set-cookie", cookieHeader(cookie, isSecure(request)))
    return response
  }
  const pathname = `submissions/${slug}/${key}.jpg`
  const filed = photoPath(id, slug, key)
  // A retry of a photo already stored is answered at once, and doesn't count against the limit.
  // Its small copy is filed again if the first attempt stopped before that.
  try {
    await head(pathname)
    try {
      await head(filed)
    } catch {
      await file(filed, small).catch(() => {})
    }
    return done()
  } catch {}
  if (!allowed(request)) return answer(429, "slow down")
  const profile = await readProfile(id)

  // The photo is stored last, so a photo in the store always has its note beside it.
  try {
    await put(
      `submissions/${slug}/${key}.json`,
      JSON.stringify({
        place: slug,
        sentAt: new Date().toISOString(),
        // Whether the camera could confirm the photo matches the old one.
        lined: checked,
        bytes: photo.length,
        // The sending phone's folder under people/, and its name when it had one at the time.
        by: id,
        ...(profile ? { name: profile.name } : {}),
      }),
      {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      }
    )
    await put(pathname, photo, {
      access: "private",
      contentType: "image/jpeg",
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    // Filed last, so the phone's list only ever shows photos that were stored.
    await file(filed, small)
  } catch (error) {
    console.error(`submit failed ${slug} ${String(error).slice(0, 300)}`)
    return answer(502, "store failed")
  }
  console.log(
    `submit-photo ${JSON.stringify({ place: slug, key, checked, bytes: photo.length, named: !!profile })}`
  )
  return done()
}

function file(pathname: string, small: Buffer) {
  return put(pathname, small, {
    access: "private",
    contentType: "image/jpeg",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}
