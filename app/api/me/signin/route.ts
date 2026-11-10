import { moveComments } from "@/lib/comments"
import { limiter, sameSite } from "@/lib/limit"
import {
  challengeHeader,
  finishSignIn,
  rememberChallenge,
  signInOptions,
} from "@/lib/passkey"
import {
  cookieHeader,
  isSecure,
  movePhotos,
  personId,
  readCookie,
} from "@/lib/people"
import { hasStore } from "@/lib/store"

// Signing in with the passkey saved at sign-up: this browser gets the person's cookie, and any
// photos it had already sent and comments it had already written on its own join theirs.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const allowed = limiter(30, 60 * 60_000)
const no = (status: number, error: string) =>
  Response.json({ error }, { status })

// Asking writes a small note to the store, so asking is limited too.
const asked = limiter(60, 60 * 60_000)

export async function GET(request: Request) {
  if (!hasStore()) return no(503, "no store")
  if (!asked(request)) return no(429, "slow down")
  try {
    const options = await signInOptions(request)
    await rememberChallenge(options.challenge)
    return Response.json(options, {
      headers: {
        "cache-control": "private, no-store",
        "set-cookie": challengeHeader(options.challenge, request),
      },
    })
  } catch (error) {
    console.error(`sign in question failed ${String(error).slice(0, 300)}`)
    return no(502, "store failed")
  }
}

export async function POST(request: Request) {
  if (!sameSite(request)) return no(403, "forbidden")
  if (!hasStore()) return no(503, "no store")
  if (!allowed(request)) return no(429, "slow down")
  try {
    const text = await request.text()
    if (text.length > 20_000) return no(413, "too big")
    const cookie = await finishSignIn(request, JSON.parse(text))
    if (!cookie) return no(401, "not signed up")
    const before = readCookie(request)
    if (before && before !== cookie) {
      await movePhotos(personId(before), personId(cookie))
      await moveComments(personId(before), personId(cookie))
    }
    const headers = new Headers({ "cache-control": "private, no-store" })
    headers.append("set-cookie", cookieHeader(cookie, isSecure(request)))
    headers.append("set-cookie", challengeHeader("", request))
    return Response.json({ ok: true }, { headers })
  } catch (error) {
    console.error(`sign in failed ${String(error).slice(0, 300)}`)
    return no(502, "store failed")
  }
}
