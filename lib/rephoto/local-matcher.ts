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
// One run at a time: a WebGPU session can't take two at once.
let queue: Promise<unknown> = Promise.resolve()

export function canMatchLocally() {
  return (
    typeof navigator !== "undefined" && "gpu" in navigator && !!navigator.gpu
  )
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
    if (!adapter?.features.has("shader-f16"))
      throw new Error("No half-precision WebGPU")
    const ort = (await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ `${ORT_BASE}ort.webgpu.min.mjs`
    )) as Ort
    ort.env.wasm.wasmPaths = ORT_BASE
    ort.env.logLevel = "error"
    const response = await fetch(MODEL_PATH)
    if (!response.ok) throw new Error(`Model ${response.status}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    const session = await ort.InferenceSession.create(bytes, {
      executionProviders: ["webgpu"],
    })
    // One run on blank pictures compiles the shaders while the shot is still being framed.
    const blank = new ort.Tensor("float32", new Float32Array(MATCH_BYTES), [
      1,
      1,
      MATCH_HEIGHT,
      MATCH_WIDTH,
    ])
    await session.run({ image0: blank, image1: blank })
    ready = true
    return { ort, session }
  })()
  loading.catch(() => {
    loading = null
    ready = false
  })
  return loading
}

// Whether the matcher is loaded and warmed up, so a match takes about a second.
export function localMatcherReady() {
  return ready
}

// Matches on the phone. A shot that was given up on (Retake, or the server took over) is dropped
// before it reaches the graphics chip.
export async function matchLocally(
  then: Uint8Array,
  now: Uint8Array,
  signal: AbortSignal
): Promise<Match[]> {
  const loaded = prepareLocalMatcher()
  if (!loaded) throw new Error("No WebGPU")
  // Giving up doesn't wait for the download; the download carries on for the next shot.
  const { ort, session } = await Promise.race([
    loaded,
    new Promise<never>((_, reject) => {
      if (signal.aborted) reject(signal.reason)
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      })
    }),
  ])
  signal.throwIfAborted()
  const tensor = (bytes: Uint8Array) => {
    const data = new Float32Array(MATCH_BYTES)
    for (let i = 0; i < data.length; i++) data[i] = bytes[i] / 255
    return new ort.Tensor("float32", data, [1, 1, MATCH_HEIGHT, MATCH_WIDTH])
  }
  const run = queue.then(() => {
    signal.throwIfAborted()
    return session.run({ image0: tensor(then), image1: tensor(now) })
  })
  queue = run.catch(() => {})
  let result
  try {
    result = await run
  } catch (error) {
    if (signal.aborted) throw error
    // A lost graphics device (phone locked, memory pressure) gets a fresh session next time.
    loading = null
    ready = false
    throw error
  }
  return cellsToMatches(
    result.match.data,
    result.confidence.data,
    result.mutual.data
  )
}
