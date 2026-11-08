import { readFile } from "node:fs/promises"
import path from "node:path"
import * as ort from "onnxruntime-node"

import {
  MATCH_BYTES,
  MATCH_CELL,
  MATCH_HEIGHT,
  MATCH_WIDTH,
  type Match,
} from "@/lib/rephoto/match"

// Runs the LoFTR image matcher on an archive photograph and a new shot, both sent as grey
// 480x352 pixels, and answers with the spots the two have in common. Pictures are not kept.

export const runtime = "nodejs"
export const maxDuration = 30

const MODEL = path.join(
  process.cwd(),
  "models",
  "loftr-coarse-352x480-fp16.onnx"
)
const MIN_CONFIDENCE = 0.2

let session: Promise<ort.InferenceSession> | null = null

function model() {
  session ??= readFile(MODEL).then((bytes) =>
    ort.InferenceSession.create(bytes, { logSeverityLevel: 3 })
  )
  session.catch(() => {
    session = null
  })
  return session
}

function tensor(bytes: Uint8Array) {
  const data = new Float32Array(MATCH_BYTES)
  for (let i = 0; i < data.length; i++) data[i] = bytes[i] / 255
  return new ort.Tensor("float32", data, [1, 1, MATCH_HEIGHT, MATCH_WIDTH])
}

export async function POST(request: Request) {
  const body = new Uint8Array(await request.arrayBuffer())
  if (body.length !== MATCH_BYTES * 2) {
    return Response.json(
      { error: `Expected ${MATCH_BYTES * 2} bytes` },
      { status: 400 }
    )
  }

  const result = await (
    await model()
  ).run({
    image0: tensor(body.subarray(0, MATCH_BYTES)),
    image1: tensor(body.subarray(MATCH_BYTES)),
  })
  const best = result.match.data as BigInt64Array | Int32Array
  const confidence = result.confidence.data as Float32Array
  const mutual = result.mutual.data as Float32Array

  const columns = MATCH_WIDTH / MATCH_CELL
  const rows = MATCH_HEIGHT / MATCH_CELL
  const matches: Match[] = []
  for (let i = 0; i < confidence.length; i++) {
    if (mutual[i] <= 0 || confidence[i] <= MIN_CONFIDENCE) continue
    const j = Number(best[i])
    const round = (n: number) => Math.round(n * 10000) / 10000
    matches.push([
      round(((i % columns) + 0.5) / columns),
      round((Math.floor(i / columns) + 0.5) / rows),
      round(((j % columns) + 0.5) / columns),
      round((Math.floor(j / columns) + 0.5) / rows),
    ])
  }

  return Response.json(
    { matches },
    { headers: { "cache-control": "no-store" } }
  )
}
