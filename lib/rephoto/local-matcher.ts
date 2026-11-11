import {
  cellsToMatches,
  MATCH_BYTES,
  MATCH_HEIGHT,
  MATCH_WIDTH,
  MODEL_PATH,
  type Match,
} from "@/lib/rephoto/match"

// Runs the image matcher on the phone's own graphics chip (WebGPU) when it has one: about half a
// second, against several on the site's server. The runtime comes from a CDN, pinned, so the
// site's own bundle stays small; the model is fetched once the camera opens.

const ORT_VERSION = "1.23.2"
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`

type Tensor<T = number> = { data: ArrayLike<T> }
type Session = {
  release?: () => Promise<void>
  run: (feeds: Record<string, unknown>) => Promise<{
    match: Tensor<number | bigint>
    confidence: Tensor
    mutual: Tensor
  }>
}
type Ort = {
  env: { wasm: { wasmPaths: string }; logLevel?: string }
  Tensor: new (type: "float32", data: Float32Array, dims: number[]) => unknown
  InferenceSession: {
    create: (bytes: Uint8Array, options: object) => Promise<Session>
  }
}

export type MatcherStatus = {
  phase: "loading" | "starting" | "ready" | "failed" | "unsupported"
  downloaded?: number
}
let status: MatcherStatus = { phase: "loading" }
const listeners = new Set<() => void>()
export const matcherStatus = () => status
export function subscribeMatcher(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
function publish(next: MatcherStatus) {
  status = next
  listeners.forEach((listener) => listener())
}
let retryAfter = 0
let generation = 0
let download: AbortController | null = null
let loading: Promise<{ ort: Ort; session: Session }> | null = null
let ready = false
// Whether a run has finished, so the shaders are compiled and later runs take their usual time.
let warm = false
// One run at a time: a WebGPU session can't take two at once.
let queue: Promise<unknown> = Promise.resolve()
const STUCK_MS = 15_000

// Set for good once the graphics chip turns out to lack half precision.
let unsupported = false

// Asking to save data doesn't turn the matcher off: someone who opens the camera came to take
// the photo, and the 22 MB model is fetched once and then kept (its name changes with it). Turning
// it off left a Pixel on 5G with no live guide at Glen Innes, 11 Nov 2026.
export function saveData() {
  return !!(navigator as { connection?: { saveData?: boolean } }).connection
    ?.saveData
}

export function canMatchLocally() {
  return (
    !unsupported &&
    typeof navigator !== "undefined" &&
    "gpu" in navigator &&
    !!navigator.gpu
  )
}

function reset() {
  generation++
  download?.abort()
  download = null
  // A session given up on hands its graphics memory back, as far as it still can.
  loading?.then(({ session }) => session.release?.()).catch(() => {})
  loading = null
  ready = false
  warm = false
  running = null
  queue = Promise.resolve()
}

// The run on the graphics chip right now, if any, and since when.
let running: { since: number } | null = null

function timeLimit<T>(promise: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Timed out")), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

// Starts loading the runtime and the model, once. Safe to call again.
export function prepareLocalMatcher() {
  if (!canMatchLocally()) {
    if (status.phase !== "unsupported") publish({ phase: "unsupported" })
    return null
  }
  if (loading) return loading
  if (performance.now() < retryAfter) return null
  const mine = generation
  const controller = new AbortController()
  download = controller
  const update = (next: MatcherStatus) => {
    if (mine === generation) publish(next)
  }
  update({ phase: "loading" })
  const work = (async () => {
    const gpu = navigator.gpu as {
      requestAdapter: () => Promise<{ features: Set<string> } | null>
    }
    const adapter = await gpu.requestAdapter()
    controller.signal.throwIfAborted()
    if (!adapter?.features.has("shader-f16")) {
      unsupported = true
      throw new Error("No half-precision WebGPU")
    }
    const ort = (await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ `${ORT_BASE}ort.webgpu.min.mjs`
    )) as Ort
    controller.signal.throwIfAborted()
    ort.env.wasm.wasmPaths = ORT_BASE
    ort.env.logLevel = "error"
    const response = await fetch(MODEL_PATH, { signal: controller.signal })
    if (!response.ok) throw new Error(`Model ${response.status}`)
    // Report only measured model bytes, not a percentage of the whole startup.
    const reader = response.body?.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        size += value.length
        update({ phase: "loading", downloaded: size })
      }
    } else {
      const bytes = new Uint8Array(await response.arrayBuffer())
      chunks.push(bytes)
      size = bytes.length
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.length
    }
    controller.signal.throwIfAborted()
    update({ phase: "starting" })
    const session = await ort.InferenceSession.create(bytes, {
      executionProviders: ["webgpu"],
      logSeverityLevel: 3,
    })
    if (mine !== generation || controller.signal.aborted) {
      await session.release?.()
      throw new Error("Matcher superseded")
    }
    // First real inference compiles shaders. Only that completion says the guide is ready.
    ready = true
    return { ort, session }
  })()
  loading = timeLimit(work, 90_000)
  loading.catch(() => {
    if (mine !== generation) return
    reset()
    retryAfter = performance.now() + 15_000
    publish({ phase: unsupported ? "unsupported" : "failed" })
  })
  return loading
}

// Whether the matcher is loaded and can be given a picture.
export function localMatcherReady() {
  return ready
}

// Whether it has finished a run already: the first one also compiles its shaders, and takes
// several times as long.
export function localMatcherWarm() {
  return warm
}

function aborted(signal: AbortSignal) {
  return new Promise<never>((_, reject) => {
    if (signal.aborted) reject(signal.reason)
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    })
  })
}

// Matches on the phone. A shot that was given up on (Retake, or the server took over) is dropped
// before it reaches the graphics chip.
export async function matchLocally(
  then: Uint8Array,
  now: Uint8Array,
  signal: AbortSignal
): Promise<Match[]> {
  // A run that never came back (graphics device lost when the phone locked, memory pressure)
  // holds up every later one, so past a limit the matcher starts over with a fresh session.
  if (running && performance.now() - running.since > (warm ? STUCK_MS : 60_000))
    reset()
  const loaded = prepareLocalMatcher()
  if (!loaded) throw new Error("No WebGPU")
  // Giving up doesn't wait for the download; the download carries on for the next shot.
  const mine = generation
  const { ort, session } = await Promise.race([loaded, aborted(signal)])
  signal.throwIfAborted()
  const tensor = (bytes: Uint8Array) => {
    const data = new Float32Array(MATCH_BYTES)
    for (let i = 0; i < data.length; i++) data[i] = bytes[i] / 255
    return new ort.Tensor("float32", data, [1, 1, MATCH_HEIGHT, MATCH_WIDTH])
  }
  let began = false
  const run = queue.then(async () => {
    signal.throwIfAborted()
    if (mine !== generation) throw new Error("Matcher superseded")
    began = true
    const activeRun = { since: performance.now() }
    running = activeRun
    try {
      const result = await timeLimit(
        session.run({
          image0: tensor(then),
          image1: tensor(now),
        }),
        warm ? STUCK_MS : 60_000
      )
      if (mine === generation) {
        warm = true
        if (status.phase !== "ready") publish({ phase: "ready" })
      }
      return result
    } finally {
      if (running === activeRun) running = null
    }
  })
  queue = run.catch(() => {
    if (mine === generation && began) {
      reset()
      retryAfter = performance.now() + 15_000
      publish({ phase: "failed" })
    }
  })
  let result
  try {
    // A caller that gives up stops waiting; the run itself can't be stopped and finishes alone.
    result = await Promise.race([run, aborted(signal)])
  } catch (error) {
    if (signal.aborted) throw error
    // A failed run gets a fresh session next time.
    if (mine === generation) {
      reset()
      retryAfter = performance.now() + 15_000
      publish({ phase: "failed" })
    }
    throw error
  }
  return cellsToMatches(
    result.match.data,
    result.confidence.data,
    result.mutual.data
  )
}
