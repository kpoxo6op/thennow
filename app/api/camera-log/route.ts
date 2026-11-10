// Receives the camera's step-by-step reports and writes each to the site's log as one JSON
// line starting with "camera-telemetry". Nothing else is kept; no address is written.

import { limiter, sameSite } from "@/lib/limit"

export const runtime = "nodejs"

const MAX_BYTES = 4096
const allowed = limiter(300, 10 * 60_000)

export async function POST(request: Request) {
  if (!sameSite(request)) return new Response(null, { status: 403 })
  const text = await request.text()
  if (text.length > MAX_BYTES) return new Response(null, { status: 413 })
  let report: Record<string, unknown>
  try {
    report = JSON.parse(text)
    if (!report || typeof report !== "object" || Array.isArray(report))
      throw new Error("Not an object")
  } catch {
    return new Response(null, { status: 400 })
  }
  if (!allowed(request)) return new Response(null, { status: 429 })
  console.log(
    `camera-telemetry ${JSON.stringify({
      ...report,
      agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      country: request.headers.get("x-vercel-ip-country"),
      time: new Date().toISOString(),
    })}`
  )
  return new Response(null, { status: 204 })
}
