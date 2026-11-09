// A rough per-network limit, kept in memory per server instance: enough to stop a script from
// filling the store, generous enough for a walking group on one Wi-Fi.
export function limiter(limit: number, windowMs: number) {
  const recent = new Map<string, number[]>()
  return (request: Request) => {
    const ip =
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      "unknown"
    const now = Date.now()
    const times = (recent.get(ip) ?? []).filter((t) => now - t < windowMs)
    if (times.length >= limit) {
      recent.set(ip, times)
      return false
    }
    times.push(now)
    recent.set(ip, times)
    if (recent.size > 10_000) {
      for (const [key, list] of recent) {
        if (list.every((t) => now - t >= windowMs)) recent.delete(key)
      }
    }
    return true
  }
}

// Only the site's own pages may change anything.
export function sameSite(request: Request) {
  const site = request.headers.get("sec-fetch-site")
  return !site || site === "same-origin"
}
