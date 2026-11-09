// Receives the camera's step-by-step reports and writes each to the site's log as one JSON
// line starting with "camera-telemetry". Nothing else is kept; no address is written.

export const runtime = "nodejs"

const MAX_BYTES = 4096
const LIMIT = 300
const WINDOW_MS = 10 * 60_000
const recent = new Map<string, number[]>()

function allowed(request: Request) {
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  const now = Date.now()
  const times = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (times.length >= LIMIT) return false
  times.push(now)
  recent.set(ip, times)
  if (recent.size > 10_000) {
    for (const [key, list] of recent) {
      if (list.every((t) => now - t >= WINDOW_MS)) recent.delete(key)
    }
  }
  return true
}

export async function POST(request: Request) {
  const site = request.headers.get("sec-fetch-site")
  if (site && site !== "same-origin") return new Response(null, { status: 403 })
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
