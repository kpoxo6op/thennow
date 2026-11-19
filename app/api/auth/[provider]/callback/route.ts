import { asProvider, isConfigured, land } from "@/lib/auth"
import { limiter } from "@/lib/limit"

// Where a provider sends people back: Google, Microsoft and Facebook with a link, Apple with a
// form posted from its own site. Either way the answer is checked here and the browser moves on
// to /api/auth/done, a plain visit of this site's own, where its own cookie is sent.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const allowed = limiter(60, 60 * 60_000)

async function handle(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const provider = asProvider((await params).provider)
  if (!provider || !isConfigured(provider))
    return Response.json({ error: "no such provider" }, { status: 404 })
  if (!allowed(request))
    return Response.json({ error: "slow down" }, { status: 429 })
  const back = await land(request, provider)
  const headers = new Headers({
    location: back.url,
    "cache-control": "private, no-store",
    "referrer-policy": "no-referrer",
  })
  for (const cookie of back.cookies) headers.append("set-cookie", cookie)
  return new Response(null, { status: 303, headers })
}

export const GET = handle
export const POST = handle
