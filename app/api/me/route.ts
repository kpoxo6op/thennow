import { limiter, sameSite } from "@/lib/limit"
import {
  cleanName,
  cookieHeader,
  hasPhotos,
  isSecure,
  newCookie,
  personId,
  readCookie,
  readProfile,
  removeProfile,
  writeProfile,
} from "@/lib/people"

// The name, if any, that goes with this phone's photos. The camera's review asks first, which is
// also when a phone gets its cookie, so even a first photo is sent already linked to it.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const allowed = limiter(30, 60 * 60_000)

function answer(
  request: Request,
  cookie: string,
  body: Record<string, unknown>,
  status = 200
) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "set-cookie": cookieHeader(cookie, isSecure(request)),
    },
  })
}

export async function GET(request: Request) {
  const cookie = readCookie(request) ?? newCookie()
  const profile = await readProfile(personId(cookie))
  return answer(request, cookie, { name: profile?.name ?? null })
}

// Adds or changes the name: only for a phone that has sent a photo.
export async function POST(request: Request) {
  if (!sameSite(request)) return Response.json({ error: "forbidden" }, { status: 403 })
  const cookie = readCookie(request)
  if (!cookie) return Response.json({ error: "no photos" }, { status: 401 })
  if (Number(request.headers.get("content-length") ?? 0) > 2_000)
    return Response.json({ error: "too big" }, { status: 413 })
  let name: string | null = null
  let sent: { place: string; key: string } | undefined
  try {
    const text = await request.text()
    if (text.length > 2_000) return Response.json({ error: "too big" }, { status: 413 })
    const body = JSON.parse(text)
    name = cleanName(body?.name)
    if (/^[a-z0-9-]{1,80}$/.test(body?.place) && /^[a-z0-9]{12,40}$/.test(body?.key))
      sent = { place: body.place, key: body.key }
  } catch {}
  if (!name) return Response.json({ error: "bad name" }, { status: 400 })
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return Response.json({ error: "no store" }, { status: 503 })
  const id = personId(cookie)
  try {
    if (!(await hasPhotos(id, sent))) return Response.json({ error: "no photos" }, { status: 401 })
    if (!allowed(request)) return Response.json({ error: "slow down" }, { status: 429 })
    await writeProfile(id, name)
  } catch (error) {
    console.error(`name failed ${String(error).slice(0, 300)}`)
    return Response.json({ error: "store failed" }, { status: 502 })
  }
  return answer(request, cookie, { name })
}

export async function DELETE(request: Request) {
  if (!sameSite(request)) return Response.json({ error: "forbidden" }, { status: 403 })
  const cookie = readCookie(request)
  if (!cookie) return Response.json({ name: null })
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return Response.json({ error: "no store" }, { status: 503 })
  try {
    await removeProfile(personId(cookie))
  } catch (error) {
    console.error(`remove name failed ${String(error).slice(0, 300)}`)
    return Response.json({ error: "store failed" }, { status: 502 })
  }
  return answer(request, cookie, { name: null })
}
