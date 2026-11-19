import { asProvider, isConfigured, startUrl } from "@/lib/auth"
import { limiter } from "@/lib/limit"

// Off to a provider to sign in: /api/auth/google?back=/mission-house

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const allowed = limiter(60, 60 * 60_000)

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const provider = asProvider((await params).provider)
  if (!provider || !isConfigured(provider))
    return Response.json({ error: "no such provider" }, { status: 404 })
  if (!allowed(request))
    return Response.json({ error: "slow down" }, { status: 429 })
  const back = new URL(request.url).searchParams.get("back")
  const { url, cookie } = startUrl(request, provider, back ?? "/me")
  return new Response(null, {
    status: 303,
    headers: {
      location: url,
      "set-cookie": cookie,
      "cache-control": "private, no-store",
      "referrer-policy": "no-referrer",
    },
  })
}
