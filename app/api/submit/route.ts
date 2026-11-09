import { head, put } from "@vercel/blob"
import sharp from "sharp"

import { fetchPending, fetchPosts } from "@/lib/api"

// Receives a photograph taken with the site's camera at one of its places and keeps it in the
// site's private photo store, where only the site's owner can see it. Nothing is published from
// here: a photo goes on the site only once the owner adds it by hand. No name, address or
// location is kept; the JPEG comes from a canvas, so it carries no camera or GPS details.

export const runtime = "nodejs"
export const maxDuration = 30

// Below Vercel's 4.5 MB request limit; the camera sends about 1-2 MB.
const MAX_BYTES = 4_000_000
// Generous: a walking group on one Wi-Fi or a shared mobile address all count as one.
const LIMIT = 60
const WINDOW_MS = 60 * 60_000
const recent = new Map<string, number[]>()

function allowed(request: Request) {
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  const now = Date.now()
  const times = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (times.length >= LIMIT) {
    recent.set(ip, times)
    return false
  }
  times.push(now)
  recent.set(ip, times)
  if (recent.size > 10_000) {
    for (const [key, list] of recent) {
      if (list.every((t) => now - t >= WINDOW_MS)) recent.delete(key)
    }
  }
  return true
}

// A real, whole JPEG of camera size, with anything but its pixels left behind. The camera's own
// files carry no metadata and are kept byte for byte; any other JPEG is drawn again without it.
async function clean(bytes: Uint8Array): Promise<Buffer | null> {
  try {
    const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" })
    const meta = await image.metadata()
    if (meta.format !== "jpeg" || !meta.width || !meta.height) return null
    await image.clone().stats()
    if (!meta.exif && !meta.xmp && !meta.iptc && !meta.icc)
      return Buffer.from(bytes)
    return await image.jpeg({ quality: 90 }).toBuffer()
  } catch {
    return null
  }
}

const answer = (status: number, error?: string) =>
  Response.json(error ? { error } : { ok: true }, { status })

export async function POST(request: Request) {
  const site = request.headers.get("sec-fetch-site")
  if (site && site !== "same-origin") return answer(403, "forbidden")

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
  const photo = await clean(bytes)
  if (!photo) return answer(415, "not a jpeg")

  if (!process.env.BLOB_READ_WRITE_TOKEN) return answer(503, "no store")
  const pathname = `submissions/${slug}/${key}.jpg`
  // A retry of a photo already stored is answered at once, and doesn't count against the limit.
  try {
    await head(pathname)
    return answer(200)
  } catch {}
  if (!allowed(request)) return answer(429, "slow down")

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
  } catch (error) {
    console.error(`submit failed ${slug} ${String(error).slice(0, 300)}`)
    return answer(502, "store failed")
  }
  console.log(`submit-photo ${JSON.stringify({ place: slug, key, checked, bytes: photo.length })}`)
  return answer(200)
}
