// Stands in for onnxruntime-web in tests: the browser has no graphics chip, so each "on-phone"
// run asks the site's server matcher instead and hands back the same per-cell answer the real
// model gives. Answers are kept per picture pair, so a live view of a still scene asks once.

const W = 480
const H = 352
const CELL = 8
const COLUMNS = W / CELL
const CELLS = COLUMNS * (H / CELL)
const answers = new Map()

export const env = { wasm: {} }

export class Tensor {
  constructor(type, data, dims) {
    this.type = type
    this.data = data
    this.dims = dims
  }
}

function cellOf(u, v) {
  return (
    Math.round((u * W - 0.5) / CELL) +
    Math.round((v * H - 0.5) / CELL) * COLUMNS
  )
}

async function run({ image0, image1 }) {
  window.__localRuns = (window.__localRuns ?? 0) + 1
  const match = new BigInt64Array(CELLS)
  const confidence = new Float32Array(CELLS)
  const mutual = new Float32Array(CELLS)
  const bytes = new Uint8Array(W * H * 2)
  let key = 0
  for (let i = 0; i < W * H; i++) {
    bytes[i] = Math.round(image0.data[i] * 255)
    bytes[W * H + i] = Math.round(image1.data[i] * 255)
    key = (key * 31 + bytes[i] * 7 + bytes[W * H + i]) % 2147483647
  }
  if (bytes.every((value) => value === 0))
    return {
      match: { data: match },
      confidence: { data: confidence },
      mutual: { data: mutual },
    }
  if (!answers.has(key)) {
    const response = await fetch("/api/align", { method: "POST", body: bytes })
    answers.set(key, response.ok ? (await response.json()).matches : [])
  }
  for (const [u0, v0, u1, v1] of answers.get(key)) {
    const i = cellOf(u0, v0)
    match[i] = BigInt(cellOf(u1, v1))
    confidence[i] = 1
    mutual[i] = 1
  }
  return {
    match: { data: match },
    confidence: { data: confidence },
    mutual: { data: mutual },
  }
}

export const InferenceSession = { create: async () => ({ run }) }
