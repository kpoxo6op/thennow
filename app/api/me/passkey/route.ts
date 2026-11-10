import { limiter, sameSite } from "@/lib/limit"
import {
  challengeHeader,
  finishSignUp,
  rememberChallenge,
  signUpOptions,
} from "@/lib/passkey"
import { personId, readCookie, readProfile, writeProfile } from "@/lib/people"
import { hasStore } from "@/lib/store"

// The second half of signing up: once a name is saved, the phone saves a passkey for it, so the
// same person can sign in on another device or after clearing this one.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const allowed = limiter(30, 60 * 60_000)
const asked = limiter(60, 60 * 60_000)
const no = (status: number, error: string) =>
  Response.json({ error }, { status })

export async function GET(request: Request) {
  const cookie = readCookie(request)
  if (!cookie) return no(401, "not signed up")
  if (!hasStore()) return no(503, "no store")
  try {
    const profile = await readProfile(personId(cookie))
    if (!profile) return no(401, "not signed up")
    if (!asked(request)) return no(429, "slow down")
    const options = await signUpOptions(request, cookie, profile.name)
    await rememberChallenge(options.challenge)
    return Response.json(options, {
      headers: {
        "cache-control": "private, no-store",
        "set-cookie": challengeHeader(options.challenge, request),
      },
    })
  } catch (error) {
    console.error(`passkey options failed ${String(error).slice(0, 300)}`)
    return no(502, "store failed")
  }
}

export async function POST(request: Request) {
  if (!sameSite(request)) return no(403, "forbidden")
  const cookie = readCookie(request)
  if (!cookie) return no(401, "not signed up")
  if (!hasStore()) return no(503, "no store")
  if (!allowed(request)) return no(429, "slow down")
  try {
    const text = await request.text()
    if (text.length > 20_000) return no(413, "too big")
    const id = personId(cookie)
    if (!(await finishSignUp(request, cookie, JSON.parse(text))))
      return no(400, "bad passkey")
    if (!(await writeProfile(id, { passkey: true })))
      return no(401, "not signed up")
    return Response.json(
      { ok: true },
      { headers: { "set-cookie": challengeHeader("", request) } }
    )
  } catch (error) {
    console.error(`passkey failed ${String(error).slice(0, 300)}`)
    return no(502, "store failed")
  }
}
