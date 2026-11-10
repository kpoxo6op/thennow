import { personId, photoPath, readCookie } from "@/lib/people"
import { get, hasStore } from "@/lib/store"

// A small copy of one of this phone's own photos, for its Your photos page. Another phone's
// photos aren't found, because the folder comes from the asking phone's own cookie.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const missing = () =>
  new Response(null, { status: 404, headers: { "cache-control": "private, no-store" } })

export async function GET(request: Request) {
  const cookie = readCookie(request)
  const url = new URL(request.url)
  const place = url.searchParams.get("place") ?? ""
  const key = url.searchParams.get("key") ?? ""
  if (!cookie || !/^[a-z0-9-]{1,80}$/.test(place) || !/^[a-z0-9]{12,40}$/.test(key))
    return missing()
  if (!hasStore()) return missing()
  try {
    const found = await get(photoPath(personId(cookie), place, key), {
      access: "private",
    })
    if (!found || found.statusCode !== 200) return missing()
    return new Response(found.stream, {
      headers: {
        "content-type": "image/jpeg",
        // Not kept by the browser: once its cookie is cleared, the phone's photos are gone from it.
        "cache-control": "private, no-store",
      },
    })
  } catch {
    return missing()
  }
}
