import { limiter, sameSite } from "@/lib/limit"
import { challengeHeader, finishSignIn, signInOptions } from "@/lib/passkey"
import { cookieHeader, isSecure, movePhotos, personId, readCookie } from "@/lib/people"

// Signing in with the passkey saved at sign-up: this browser gets the person's cookie, and any
// photos it had already sent on its own join theirs.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const allowed = limiter(30, 60 * 60_000)
const no = (status: number, error: string) => Response.json({ error }, { status })

export async function GET(request: Request) {
  const options = await signInOptions(request)
  return Response.json(options, {
    headers: {
      "cache-control": "private, no-store",
      "set-cookie": challengeHeader(options.challenge, request),
    },
  })
}

export async function POST(request: Request) {
  if (!sameSite(request)) return no(403, "forbidden")
  if (!process.env.BLOB_READ_WRITE_TOKEN) return no(503, "no store")
  if (!allowed(request)) return no(429, "slow down")
  try {
    const text = await request.text()
    if (text.length > 20_000) return no(413, "too big")
    const cookie = await finishSignIn(request, JSON.parse(text))
    if (!cookie) return no(401, "not signed up")
    const before = readCookie(request)
    if (before && before !== cookie) await movePhotos(personId(before), personId(cookie))
    const headers = new Headers({ "cache-control": "private, no-store" })
    headers.append("set-cookie", cookieHeader(cookie, isSecure(request)))
    headers.append("set-cookie", challengeHeader("", request))
    return Response.json({ ok: true }, { headers })
  } catch (error) {
    console.error(`sign in failed ${String(error).slice(0, 300)}`)
    return no(502, "store failed")
  }
}
