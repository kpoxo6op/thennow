import { limiter, sameSite } from "@/lib/limit"
import {
  boundedNumber,
  BROWSERS,
  buildLabel,
  sanitizeEvent,
  TELEMETRY_MAX_BYTES,
  TELEMETRY_MAX_EVENTS,
} from "@/lib/rephoto/telemetry-schema"

export const runtime = "nodejs"
const allowed = limiter(300, 10 * 60_000)

export async function POST(request: Request) {
  if (!sameSite(request)) return new Response(null, { status: 403 })
  if (!allowed(request)) return new Response(null, { status: 429 })
  const reader = request.body?.getReader()
  if (!reader) return new Response(null, { status: 400 })
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > TELEMETRY_MAX_BYTES) {
        await reader.cancel()
        return new Response(null, { status: 413 })
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    const input = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    )
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error("object")
    let clean: Record<string, unknown>
    if (input.version === 2) {
      if (
        typeof input.session !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(input.session) ||
        !boundedNumber(input.seq, 1, 100000) ||
        !Number.isInteger(input.seq) ||
        !boundedNumber(input.dropped, 0, 10000000) ||
        !boundedNumber(input.deliveryFailures, 0, 10000000) ||
        !Array.isArray(input.events) ||
        input.events.length < 1 ||
        input.events.length > TELEMETRY_MAX_EVENTS
      )
        throw new Error("envelope")
      const events = input.events.map(sanitizeEvent)
      if (events.some((event: unknown) => !event)) throw new Error("event")
      clean = {
        version: 2,
        session: input.session,
        build: buildLabel(input.build),
        browser: BROWSERS.includes(input.browser) ? input.browser : "other",
        seq: input.seq,
        produced: boundedNumber(input.produced, 0, 1000)
          ? input.produced
          : null,
        eventLimitReached: input.eventLimitReached === true,
        dropped: input.dropped,
        deliveryFailures: input.deliveryFailures,
        events,
      }
    } else {
      // Cached clients remain useful, but their free-form fields are never logged.
      const event = sanitizeEvent({ ...input, at: input.at ?? 0 })
      if (!event) throw new Error("legacy event")
      clean = {
        version: 1,
        session:
          typeof input.visit === "string" &&
          /^[a-z0-9-]{8,36}$/i.test(input.visit)
            ? input.visit
            : "unknown",
        events: [event],
      }
    }
    console.log(
      `camera-telemetry ${JSON.stringify({ ...clean, receiverBuild: buildLabel(process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_CAMERA_BUILD), time: new Date().toISOString() })}`
    )
    return new Response(null, { status: 204 })
  } catch {
    return new Response(null, { status: 400 })
  } finally {
    reader.releaseLock()
  }
}
