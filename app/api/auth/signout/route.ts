import { sameSite } from "@/lib/limit"
import { COOKIE, isSecure } from "@/lib/people"

// Signing out forgets the person on this browser only. Signing in again brings everything back.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!sameSite(request))
    return Response.json({ error: "forbidden" }, { status: 403 })
  return Response.json(
    { ok: true },
    {
      headers: {
        "cache-control": "private, no-store",
        "set-cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isSecure(request) ? "; Secure" : ""}`,
      },
    }
  )
}
