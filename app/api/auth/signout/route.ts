import { AUTH_COOKIES } from "@/lib/auth"
import { sameSite } from "@/lib/limit"
import { COOKIE, isSecure } from "@/lib/people"

// Signing out forgets the person on this browser only. Signing in again brings everything back.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!sameSite(request))
    return Response.json({ error: "forbidden" }, { status: 403 })
  // A sign-in still on its way is called off too, so it can't sign this browser back in.
  const secure = isSecure(request) ? "; Secure" : ""
  const headers = new Headers({ "cache-control": "private, no-store" })
  headers.append(
    "set-cookie",
    `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`
  )
  for (const name of AUTH_COOKIES)
    headers.append(
      "set-cookie",
      `${name}=; Path=/api/auth; Max-Age=0; HttpOnly; SameSite=Lax${secure}`
    )
  return Response.json({ ok: true }, { headers })
}
