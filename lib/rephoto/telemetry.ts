import { track } from "@vercel/analytics"

// What happens on the camera, so it can be made better: counts go to the site's analytics, and
// the details of each step go to the site's own log. Never pictures, places or who someone is:
// a visit is a random id that lives only as long as the page.

type Value = string | number | boolean | null

const visit =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
const opened = typeof performance !== "undefined" ? performance.now() : 0

export function report(
  event: string,
  details: Record<string, Value> = {},
  // At most two short values for the analytics counts; the rest only reach the log.
  counted: Record<string, Value> = {}
) {
  if (typeof window === "undefined") return
  try {
    track(`camera ${event}`, counted)
  } catch {}
  try {
    const body = JSON.stringify({
      visit,
      event,
      at: Math.round(performance.now() - opened),
      path: location.pathname,
      ...counted,
      ...details,
    })
    // Not sendBeacon: Firefox on Android says it sent one and never does.
    fetch("/api/camera-log", { method: "POST", body, keepalive: true }).catch(
      () => {}
    )
  } catch {}
}

export function browserName() {
  const agent = navigator.userAgent
  if (/Firefox\//.test(agent)) return "firefox"
  if (/EdgA?\//.test(agent)) return "edge"
  if (/SamsungBrowser\//.test(agent)) return "samsung"
  if (/CriOS|Chrome\//.test(agent)) return "chrome"
  if (/Safari\//.test(agent)) return "safari"
  return "other"
}
