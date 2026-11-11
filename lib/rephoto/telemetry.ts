import { track } from "@vercel/analytics"

import {
  buildLabel,
  sanitizeDetails,
  TELEMETRY_MAX_BYTES,
  TELEMETRY_MAX_EVENTS,
  type TelemetryEvent,
  type TelemetryValue,
} from "./telemetry-schema"

type Session = {
  ended: boolean
  id: string
  opened: number
  startedAt: number
  run: number
  seq: number
  captures: number
  capture: number
  produced: number
  dropped: number
  deliveryFailures: number
}
let session: Session | undefined
const queue: { session: Session; event: TelemetryEvent }[] = []
let timer: ReturnType<typeof setTimeout> | undefined
let inFlight = false
let listening = false
const now = () => performance.now()
const makeSession = (): Session => ({
  ended: false,
  id: crypto.randomUUID(),
  opened: now(),
  startedAt: Date.now(),
  run: 0,
  seq: 0,
  captures: 0,
  capture: 0,
  produced: 0,
  dropped: 0,
  deliveryFailures: 0,
})

function schedule() {
  if (!timer && queue.length)
    timer = setTimeout(() => {
      timer = undefined
      flushTelemetry()
    }, 5000)
}
function listen() {
  if (listening) return
  listening = true
  window.addEventListener("pagehide", () => {
    if (!session || session.ended) return
    diagnostic("visibility", { visible: false, reason: "pagehide" })
    flushTelemetry()
  })
  document.addEventListener("visibilitychange", () => {
    if (!session || session.ended) return
    diagnostic("visibility", {
      visible: document.visibilityState === "visible",
      reason: document.visibilityState === "visible" ? "visible" : "hidden",
    })
    if (document.visibilityState !== "visible") flushTelemetry()
  })
}
export function startCameraSession() {
  if (typeof window === "undefined") return
  flushTelemetry()
  session = makeSession()
  listen()
}
export function beginCameraRun(run: number) {
  if (!session && typeof window !== "undefined") startCameraSession()
  if (session && Number.isFinite(run)) {
    session.run = Math.max(0, Math.min(10000, Math.round(run)))
    session.capture = 0
  }
}
export function diagnostic(
  event: string,
  details: Record<string, TelemetryValue> = {}
) {
  if (typeof window === "undefined") return
  const clean = sanitizeDetails(event, details)
  if (!clean) return
  session ??= makeSession()
  if (session.ended) return
  listen()
  if (session.produced >= 1000 || queue.length >= 128) {
    session.dropped++
    if (event === "session end") {
      session.ended = true
      flushTelemetry()
    }
    return
  }
  session.produced++
  queue.push({
    session,
    event: {
      event,
      at: Math.round(now() - session.opened),
      run: session.run,
      ...clean,
      capture: session.capture,
    },
  })
  if (event === "session end") {
    session.ended = true
    flushTelemetry()
  } else schedule()
}

// Workflow counts only; diagnostic transitions never enter product analytics.
export function report(
  event: string,
  details: Record<string, TelemetryValue> = {},
  counted: Record<string, TelemetryValue> = {}
) {
  if (typeof window === "undefined") return
  if (session?.ended) return
  const clean = sanitizeDetails(event, counted)
  if (!clean) return
  try {
    track(`camera ${event}`, clean)
  } catch {}
  session ??= makeSession()
  if (event === "shot") session.capture = ++session.captures
  diagnostic(event, { ...counted, ...details })
  if (
    [
      "open",
      "shot",
      "retake",
      "review",
      "send",
      "save",
      "save failed",
      "camera error",
    ].includes(event)
  )
    flushTelemetry()
}

export function flushTelemetry() {
  if (typeof window === "undefined" || inFlight || !queue.length) return
  if (timer) clearTimeout(timer)
  timer = undefined
  const owner = queue[0].session
  const events: TelemetryEvent[] = []
  const envelope = () => ({
    version: 2,
    session: owner.id,
    startedAt: owner.startedAt,
    build: buildLabel(process.env.NEXT_PUBLIC_CAMERA_BUILD),
    browser: browserName(),
    seq: owner.seq,
    produced: owner.produced,
    eventLimitReached: owner.produced >= 1000,
    dropped: owner.dropped,
    deliveryFailures: owner.deliveryFailures,
    events,
  })
  while (events.length < TELEMETRY_MAX_EVENTS && queue[0]?.session === owner) {
    events.push(queue[0].event)
    if (
      new TextEncoder().encode(JSON.stringify(envelope())).length >
      TELEMETRY_MAX_BYTES
    ) {
      events.pop()
      break
    }
    queue.shift()
  }
  if (!events.length) {
    queue.shift()
    owner.dropped++
    schedule()
    return
  }
  owner.seq++
  // Retries reuse the exact sequence and payload. The reader can deduplicate them.
  const body = JSON.stringify({ ...envelope(), seq: owner.seq })
  inFlight = true
  const send = async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      try {
        const response = await fetch("/api/camera-log", {
          method: "POST",
          body,
          keepalive: true,
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
        })
        if (response.ok) return
        owner.deliveryFailures++
        if (response.status < 500 && response.status !== 429) break
      } catch {
        owner.deliveryFailures++
      } finally {
        clearTimeout(timeout)
      }
      if (attempt < 2)
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
    }
    owner.dropped += events.length
  }
  void send().finally(() => {
    inFlight = false
    if (queue.length) flushTelemetry()
  })
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

// A per-upload correlation tag, never an account ID or upload credential.
export async function submissionTag(key: string): Promise<string | null> {
  try {
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(key)
    )
    return Array.from(new Uint8Array(hash))
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16)
  } catch {
    return null
  }
}
