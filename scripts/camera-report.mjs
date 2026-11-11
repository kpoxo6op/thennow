#!/usr/bin/env node
// Offline only: node scripts/camera-report.mjs [vercel-json-lines-file ...]
// Accepts raw camera-telemetry lines or Vercel JSON wrappers containing those lines.
import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"

const sessions = new Map()
let malformed = 0
function extract(value) {
  if (typeof value === "string") {
    try {
      return extract(JSON.parse(value))
    } catch {}
    const marker = value.indexOf("camera-telemetry ")
    if (marker >= 0) {
      try {
        return extract(
          JSON.parse(value.slice(marker + "camera-telemetry ".length))
        )
      } catch {
        malformed++
      }
    }
    return
  }
  if (!value || typeof value !== "object") return
  if (
    value.version === 2 &&
    typeof value.session === "string" &&
    Array.isArray(value.events)
  )
    return value
  for (const child of Object.values(value)) {
    const found = extract(child)
    if (found) return found
  }
}
for (const filename of process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["-"]) {
  const lines = createInterface({
    input: filename === "-" ? process.stdin : createReadStream(filename),
    crlfDelay: Infinity,
  })
  for await (const line of lines) {
    const batch = extract(line)
    if (!batch) continue
    const list = sessions.get(batch.session) ?? []
    list.push(batch)
    sessions.set(batch.session, list)
  }
}
const scalar = (value) =>
  typeof value === "string" ||
  typeof value === "boolean" ||
  (typeof value === "number" && Number.isFinite(value))
const clean = (value) =>
  String(value)
    .replace(/[\x00-\x1f\x7f]/g, "")
    .slice(0, 160)
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`
for (const [session, batches] of sessions) {
  batches.sort((a, b) => a.seq - b.seq)
  const unique = new Map(batches.map((batch) => [batch.seq, batch]))
  const ordered = [...unique.values()]
  const gaps = []
  let expected = 1
  for (const batch of ordered) {
    if (batch.seq > expected) gaps.push(`${expected}..${batch.seq - 1}`)
    expected = batch.seq + 1
  }
  const events = ordered
    .flatMap((batch) => batch.events)
    .filter((event) => Number.isFinite(event.at))
    .sort((a, b) => a.at - b.at)
  const last = ordered.at(-1)
  console.log(
    `\nSession ${clean(session)} | build ${clean(last.build)} | ${clean(last.browser)}`
  )
  const startedAt = ordered.find((batch) => Number.isFinite(batch.startedAt))?.startedAt
  console.log(`Client session start: ${startedAt ? new Date(startedAt).toISOString() : "unavailable (older client)"}; compare with recording clock, allowing for phone clock error.`)
  console.log(
    `Batches ${unique.size}; duplicate batches ${batches.length - unique.size}; gaps ${gaps.join(", ") || "none observed"}; client dropped ${Math.max(...ordered.map((b) => b.dropped ?? 0))}; delivery failures ${Math.max(...ordered.map((b) => b.deliveryFailures ?? 0))}`
  )
  const rejects = new Map()
  for (const event of events) {
    const details = Object.entries(event)
      .filter(
        ([key, value]) => !["event", "at", "run"].includes(key) && scalar(value)
      )
      .map(([key, value]) => `${clean(key)}=${clean(value)}`)
      .join(" ")
    console.log(
      `  ${startedAt ? new Date(startedAt + event.at).toISOString() : ""} ${seconds(event.at).padStart(9)} run=${clean(event.run ?? "?")} ${clean(event.event)} ${details}`
    )
    if (
      typeof event.reason === "string" &&
      !["accepted", "eligible"].includes(event.reason)
    )
      rejects.set(event.reason, (rejects.get(event.reason) ?? 0) + 1)
  }
  if (rejects.size)
    console.log(
      `Observed reason events: ${[...rejects].map(([reason, count]) => `${clean(reason)}=${count}`).join(", ")}`
    )
  const started = events.some((event) => event.event === "open")
  const ended = events.some((event) => event.event === "session end")
  const capped = ordered.some((batch) => batch.eventLimitReached)
  const dropped = ordered.some((batch) => batch.dropped > 0)
  console.log(
    `Lifecycle: start ${started ? "observed" : "missing"}; end ${ended ? "observed" : "missing"}; camera runs ${new Set(events.filter((event) => event.run > 0).map((event) => event.run)).size}.`
  )
  if (!started || !ended || capped || dropped || gaps.length)
    console.log(
      `Incomplete evidence:${!started ? " missing start;" : ""}${!ended ? " missing end;" : ""}${capped ? " event cap reached;" : ""}${dropped ? " dropped events;" : ""}${gaps.length ? " sequence gaps;" : ""}`
    )
  console.log(
    "Absence of gaps does not prove complete delivery; an offline/crashed tail can be missing. Logs cannot establish visual alignment quality."
  )
}
console.log(
  `\n${sessions.size} schema-2 sessions; ${malformed} malformed telemetry records.`
)
