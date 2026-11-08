import { readFile } from "node:fs/promises"
import { availableParallelism } from "node:os"
import path from "node:path"
import * as ort from "onnxruntime-node"

import {
  cellsToMatches,
  MATCH_BYTES,
  MATCH_HEIGHT,
  MATCH_WIDTH,
  MODEL_PATH,
} from "@/lib/rephoto/match"

// Runs the LoFTR image matcher on an archive photograph and a new shot, both sent as grey
// 480x352 pixels, and answers with the spots the two have in common. Pictures are not kept.

export const runtime = "nodejs"
export const maxDuration = 30

const MODEL = path.join(process.cwd(), "public", MODEL_PATH)

let session: Promise<ort.InferenceSession> | null = null

function model() {
  session ??= readFile(MODEL).then((bytes) =>
    ort.InferenceSession.create(bytes, {
      logSeverityLevel: 3,
      // One thread per CPU the function actually has, not per core of the machine under it.
      intraOpNumThreads: Math.max(1, availableParallelism()),
    })
  )
  session.catch(() => {
    session = null
  })
  return session
}

// Matching costs seconds of CPU here, so it is for this site's own camera only, and each visitor
// gets a camera's worth of shots: at most LIMIT in WINDOW_MS. Counts are per function instance.
const LIMIT = 20
const WINDOW_MS = 10 * 60_000
const recent = new Map<string, number[]>()

function sameSite(request: Request) {
  const site = request.headers.get("sec-fetch-site")
  return !site || site === "same-origin"
}

function allowed(request: Request) {
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  const now = Date.now()
  const times = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (times.length >= LIMIT) {
    recent.set(ip, times)
    return false
  }
  times.push(now)
  recent.set(ip, times)
  if (recent.size > 10_000) {
    for (const [key, list] of recent) {
      if (list.every((t) => now - t >= WINDOW_MS)) recent.delete(key)
    }
  }
  return true
}

function tensor(bytes: Uint8Array) {
  const data = new Float32Array(MATCH_BYTES)
  for (let i = 0; i < data.length; i++) data[i] = bytes[i] / 255
  return new ort.Tensor("float32", data, [1, 1, MATCH_HEIGHT, MATCH_WIDTH])
}

export async function POST(request: Request) {
  if (!sameSite(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }
  const body = new Uint8Array(await request.arrayBuffer())
  if (body.length !== MATCH_BYTES * 2) {
    return Response.json(
      { error: `Expected ${MATCH_BYTES * 2} bytes` },
      { status: 400 }
    )
  }
  // Only well-formed requests count towards the limit.
  if (!allowed(request)) {
    return Response.json({ error: "Too many requests" }, { status: 429 })
  }

  const started = performance.now()
  let result
  try {
    result = await (
      await model()
    ).run({
      image0: tensor(body.subarray(0, MATCH_BYTES)),
      image1: tensor(body.subarray(MATCH_BYTES)),
    })
  } catch {
    return Response.json({ error: "Matcher unavailable" }, { status: 503 })
  }
  const matches = cellsToMatches(
    result.match.data as BigInt64Array,
    result.confidence.data as Float32Array,
    result.mutual.data as Float32Array
  )

  return Response.json(
    { matches },
    {
      headers: {
        "cache-control": "no-store",
        "server-timing": `match;dur=${Math.round(performance.now() - started)}`,
      },
    }
  )
}
