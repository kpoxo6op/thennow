import { limiter, sameSite } from "@/lib/limit"
import {
  cleanName,
  cookieHeader,
  isSecure,
  newCookie,
  personId,
  readCookie,
  readProfile,
  removeProfile,
  writeProfile,
} from "@/lib/people"

// The name, if any, that goes with this browser's photos. The camera's review asks first, which
// is also when a browser gets its cookie, so even a first photo is sent already linked to it.
// Saving a name is signing up: it needs no photo, so it can be done before or after sending.

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
  // Without the store the cookie is still given and renewed; the name just isn't known.
  const profile = await readProfile(personId(cookie)).catch(() => null)
  return answer(request, cookie, { name: profile?.name ?? null, passkey: !!profile?.passkey })
}

// Signs up, or changes the name.
export async function POST(request: Request) {
  if (!sameSite(request)) return Response.json({ error: "forbidden" }, { status: 403 })
  const cookie = readCookie(request) ?? newCookie()
  if (Number(request.headers.get("content-length") ?? 0) > 2_000)
    return Response.json({ error: "too big" }, { status: 413 })
  let name: string | null = null
  try {
    const text = await request.text()
    if (text.length > 2_000) return Response.json({ error: "too big" }, { status: 413 })
    name = cleanName(JSON.parse(text)?.name)
  } catch {}
  if (!name) return Response.json({ error: "bad name" }, { status: 400 })
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return Response.json({ error: "no store" }, { status: 503 })
  if (!allowed(request)) return Response.json({ error: "slow down" }, { status: 429 })
  const id = personId(cookie)
  try {
    return answer(request, cookie, { ...(await writeProfile(id, { name })) })
  } catch (error) {
    console.error(`name failed ${String(error).slice(0, 300)}`)
    return Response.json({ error: "store failed" }, { status: 502 })
  }
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
  return answer(request, cookie, { name: null, passkey: false })
}
