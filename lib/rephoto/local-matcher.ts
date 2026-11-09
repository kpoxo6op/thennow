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

let loading: Promise<{ ort: Ort; session: Session }> | null = null
let ready = false
// Whether a run has finished, so the shaders are compiled and later runs take their usual time.
let warm = false
// One run at a time: a WebGPU session can't take two at once.
let queue: Promise<unknown> = Promise.resolve()
const STUCK_MS = 15_000

// Set for good once the graphics chip turns out to lack half precision.
let unsupported = false

// Cellular users who asked to save data aren't sent the 22 MB matcher.
function saveData() {
  return !!(navigator as { connection?: { saveData?: boolean } }).connection
    ?.saveData
}

export function canMatchLocally() {
  return (
    !unsupported &&
    typeof navigator !== "undefined" &&
    !saveData() &&
    "gpu" in navigator &&
    !!navigator.gpu
  )
}

function reset() {
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
  if (!canMatchLocally()) return null
  loading ??= (async () => {
    // The model is in half precision; a graphics chip without it goes straight to the server.
    const gpu = navigator.gpu as {
      requestAdapter: () => Promise<{ features: Set<string> } | null>
    }
    const adapter = await gpu.requestAdapter()
    if (!adapter?.features.has("shader-f16")) {
      unsupported = true
      throw new Error("No half-precision WebGPU")
    }
    const ort = (await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ `${ORT_BASE}ort.webgpu.min.mjs`
    )) as Ort
    ort.env.wasm.wasmPaths = ORT_BASE
    ort.env.logLevel = "error"
    const response = await fetch(MODEL_PATH)
    if (!response.ok) throw new Error(`Model ${response.status}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    const session = await timeLimit(
      ort.InferenceSession.create(bytes, {
        executionProviders: ["webgpu"],
        logSeverityLevel: 3,
      }),
      60_000
    )
    // No warm-up run on blank pictures: the first real match compiles the shaders instead,
    // which saves a whole run (seconds on a phone) before the old view can first be found.
    ready = true
    return { ort, session }
  })()
  loading.catch(reset)
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
  const { ort, session } = await Promise.race([loaded, aborted(signal)])
  signal.throwIfAborted()
  const tensor = (bytes: Uint8Array) => {
    const data = new Float32Array(MATCH_BYTES)
    for (let i = 0; i < data.length; i++) data[i] = bytes[i] / 255
    return new ort.Tensor("float32", data, [1, 1, MATCH_HEIGHT, MATCH_WIDTH])
  }
  const run = queue.then(async () => {
    signal.throwIfAborted()
    const mine = { since: performance.now() }
    running = mine
    try {
      const result = await session.run({
        image0: tensor(then),
        image1: tensor(now),
      })
      warm = true
      return result
    } finally {
      if (running === mine) running = null
    }
  })
  queue = run.catch(() => {})
  let result
  try {
    // A caller that gives up stops waiting; the run itself can't be stopped and finishes alone.
    result = await Promise.race([run, aborted(signal)])
  } catch (error) {
    if (signal.aborted) throw error
    // A failed run gets a fresh session next time.
    reset()
    throw error
  }
  return cellsToMatches(
    result.match.data,
    result.confidence.data,
    result.mutual.data
  )
}
