// Shared by sender and receiver. Only these fields can enter the diagnostic log.
export type TelemetryValue = string | number | boolean | null
export type TelemetryEvent = {
  event: string
  at: number
  run: number
} & Record<string, TelemetryValue>
export const TELEMETRY_MAX_BYTES = 12 * 1024
export const TELEMETRY_MAX_EVENTS = 16
export const BROWSERS = [
  "firefox",
  "edge",
  "samsung",
  "chrome",
  "safari",
  "other",
]
const fields: Record<string, string[]> = {
  experiment: ["reference", "mode", "overlay", "features"],
  "guide view": [
    "view",
    "overlay",
    "reveal",
    "viewportWidth",
    "viewportHeight",
  ],
  assistance: [
    "state",
    "supported",
    "regions",
    "residual",
    "frameAge",
    "ms",
    "reason",
    "sampleMs",
    "modelMs",
    "refineMs",
    "identityAge",
  ],
  burst: ["frames", "selected", "assisted", "ms", "reason"],
  framing: ["phase", "cropX", "cropY", "cropWidth", "cropRotation", "aspect"],
  open: ["gpu", "saveData", "browser", "matcher"],
  stream: ["ask", "allowed", "width", "height", "fps"],
  "stream failed": ["ask", "error"],
  "matcher ready": ["ms"],
  "matcher failed": ["ms", "error"],
  "no picture": ["ready", "paused", "ended", "plain", "error"],
  live: ["width", "height", "ms"],
  restart: ["reason"],
  "camera error": ["error"],
  "live matching": [
    "runs",
    "found",
    "rejected",
    "lost",
    "matchMs",
    "prepareMs",
    "modelMs",
    "firstFound",
    "firstSteady",
    "seconds",
    "steady",
  ],
  shot: [
    "width",
    "height",
    "lean",
    "zoom",
    "steady",
    "framing",
    "how",
    "capture",
    "cropX",
    "cropY",
    "cropWidth",
    "cropRotation",
    "aspect",
    "frameAge",
    "mediaTime",
    "reveal",
    "overlay",
  ],
  retake: ["capture"],
  review: [
    "result",
    "ms",
    "live",
    "whole",
    "moved",
    "zoom",
    "turn",
    "capture",
    "error",
  ],
  send: ["bytes", "phase", "ms", "result", "capture", "submissionTag"],
  save: ["bytes", "how", "phase", "capture"],
  "save failed": ["cancelled", "error", "capture"],
  turned: ["ok", "to"],
  "match result": [
    "attempt",
    "outcome",
    "reason",
    "backend",
    "warm",
    "prepareMs",
    "modelMs",
    "matchMs",
    "frameAge",
    "inliers",
    "rawMatches",
    "matches",
    "fallbackReason",
    "reach",
    "dx",
    "dy",
    "scaleDelta",
    "rotationDelta",
  ],
  cue: ["kind", "x", "y", "scale", "roll", "snapped", "age"],
  guide: [
    "state",
    "reason",
    "trackedAge",
    "confirmedAge",
    "frameAge",
    "motion",
    "held",
    "steady",
  ],
  heartbeat: [
    "state",
    "runs",
    "found",
    "rejected",
    "lost",
    "firstFound",
    "firstSteady",
    "seconds",
    "inFlightMs",
    "frameAge",
    "held",
    "steady",
  ],
  visibility: ["visible", "reason"],
  "session end": ["reason"],
}
const enums: Record<string, string[]> = {
  mode: ["traces", "split"],
  view: ["archive", "traces", "split"],
  browser: BROWSERS,
  matcher: ["phone", "server", "traced"],
  backend: ["local", "remote", "none", "phone", "server"],
  error: [
    "NotAllowedError",
    "NotFoundError",
    "NotReadableError",
    "OverconstrainedError",
    "AbortError",
    "TimeoutError",
    "SecurityError",
    "other",
  ],
  framing: ["live", "levelled", "traced", "snapped"],
  kind: [
    "left",
    "right",
    "up",
    "down",
    "closer",
    "back",
    "clockwise",
    "anticlockwise",
    "hold",
    "none",
  ],
  how: ["manual", "auto", "share", "download"],
  phase: ["aligning", "framed", "aligned", "unchecked", "unmatched"],
  result: [
    "framed",
    "unchecked",
    "aligned",
    "kept live",
    "unmatched",
    "sent",
    "failed",
    "error",
    "offline",
    "busy",
    "too-large",
    "limited",
    "refused",
  ],
  to: ["portrait", "landscape"],
  state: [
    "searching",
    "candidate",
    "held",
    "steady",
    "lost",
    "refused",
    "tracing",
    "conflict",
    "adjusted",
    "unavailable",
  ],
  outcome: ["accepted", "candidate", "rejected", "miss", "discarded", "error"],
  fallbackReason: [
    "local_timeout",
    "local_inference_error",
    "model_unavailable",
  ],
  reason: [
    "insufficient_matches",
    "insufficient_inliers",
    "degenerate",
    "rotation",
    "scale",
    "spread",
    "coverage",
    "accepted",
    "aborted",
    "local_timeout",
    "local_inference_error",
    "model_unavailable",
    "server_timeout",
    "server_error",
    "prepare_error",
    "ended",
    "muted",
    "no frames",
    "first",
    "agreement",
    "disagreement",
    "tracking-failed",
    "expired",
    "misses",
    "hidden",
    "resize",
    "view-changed",
    "stale-result",
    "drift-failed",
    "frame-unavailable",
    "thumbnail-unavailable",
    "not-live",
    "interrupted",
    "peek",
    "not-steady",
    "stale-tracking",
    "stale-frame",
    "outside-crop",
    "stale-confirmation",
    "moving",
    "paused",
    "visible",
    "pagehide",
    "unmount",
  ],
}
const booleans = new Set([
  "plain",
  "gpu",
  "saveData",
  "allowed",
  "paused",
  "ended",
  "steady",
  "live",
  "whole",
  "cancelled",
  "ok",
  "warm",
  "held",
  "eligible",
  "visible",
  "snapped",
])
export function boundedNumber(
  value: unknown,
  min = 0,
  max = 86_400_000
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  )
}
export function sanitizeDetails(
  event: string,
  input: Record<string, unknown>
): Record<string, TelemetryValue> | null {
  if (!Object.hasOwn(fields, event)) return null
  const output: Record<string, TelemetryValue> = {}
  for (const key of fields[event]) {
    const value = input[key]
    if (event === "assistance" || event === "burst") {
      if (key === "reason") {
        const allowed =
          event === "burst"
            ? [
                "no_identity",
                "expired_identity",
                "rejected_geometry",
                "assisted",
              ]
            : [
                "identity_not_found",
                "invalid_seed",
                "insufficient_archive_edges",
                "insufficient_unique_edges",
                "unconstrained_geometry",
                "outside_local_search",
                "regional_disagreement",
                "local_edges_supported_unverified",
                "missing_or_changed_edges",
                "worker_failed",
                "stale_frame",
              ]
        if (typeof value === "string" && allowed.includes(value))
          output[key] = value
      } else if (key === "state") {
        if (
          typeof value === "string" &&
          ["searching", "conflict", "adjusted", "unavailable"].includes(value)
        )
          output[key] = value
      } else if (key === "assisted") {
        if (typeof value === "boolean") output[key] = value
      } else if (key === "residual" && value === null) output[key] = null
      else if (boundedNumber(value))
        output[key] = Math.round(value * 1000) / 1000
    } else if (key === "submissionTag") {
      if (typeof value === "string" && /^[a-f0-9]{16}$/.test(value))
        output[key] = value
    } else if (value === null) output[key] = null
    else if (enums[key]) {
      if (typeof value === "string" && enums[key].includes(value))
        output[key] = value
    } else if (booleans.has(key)) {
      if (typeof value === "boolean") output[key] = value
    } else if (boundedNumber(value, -1000))
      output[key] = Math.round(value * 1000) / 1000
  }
  // Legacy errors are deliberately not retained, even when they contain a URL or token.
  if (
    fields[event].includes("error") &&
    !output.error &&
    (input.message != null || input.why != null)
  )
    output.error = "other"
  return output
}
export function sanitizeEvent(input: unknown): TelemetryEvent | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null
  const item = input as Record<string, unknown>
  if (
    typeof item.event !== "string" ||
    !boundedNumber(item.at) ||
    !boundedNumber(item.run ?? 0, 0, 10000)
  )
    return null
  if (!boundedNumber(item.capture ?? 0, 0, 10000)) return null
  const details = sanitizeDetails(item.event, item)
  return (
    details && {
      event: item.event,
      at: Math.round(item.at),
      run: Math.round((item.run as number) ?? 0),
      ...details,
      capture: Math.round((item.capture as number) ?? 0),
    }
  )
}
export function buildLabel(value: unknown): string {
  return typeof value === "string" && /^[a-f0-9]{7,64}$/i.test(value)
    ? value.slice(0, 40)
    : "unknown"
}
