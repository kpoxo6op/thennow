import { readFile, realpath } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

import { fetchPending, fetchPosts } from "@/lib/api"
import {
  DECISION_INSTRUCTIONS,
  GEOMETRY_QUESTIONS,
  type CameraDecisionAction,
  type CameraDecisionProgress,
  type DecisionFrame,
  type DecisionResult,
} from "@/lib/rephoto/decision"

export const runtime = "nodejs"
const BODY_LIMIT = 512 * 1024
const IMAGE_LIMIT = 200 * 1024
const WINDOW = 10 * 60 * 1000
// Deliberately instance-local. This is not a distributed quota or authentication.
let windowStart = 0
let requests = 0
const networks = new Map<string, number>()
function allowed(request: Request) {
  const now = Date.now()
  if (now - windowStart >= WINDOW) {
    windowStart = now
    requests = 0
    networks.clear()
  }
  // Only trust Vercel's overwritten header there; otherwise share one local bucket.
  const network =
    process.env.VERCEL === "1"
      ? (
          request.headers
            .get("x-vercel-forwarded-for")
            ?.split(",")[0]
            ?.trim() || "unknown"
        ).slice(0, 100)
      : "local"
  const count = networks.get(network) ?? 0
  if (requests >= 300 || count >= 60) return false
  requests++
  networks.set(network, count + 1)
  return true
}
async function boundedJson(
  stream: ReadableStream<Uint8Array> | null,
  limit: number
): Promise<unknown> {
  if (!stream) throw new Error("body")
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > limit) {
        await reader.cancel()
        throw new Error("body")
      }
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } finally {
    reader.releaseLock()
  }
}
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}
async function frame(value: unknown): Promise<DecisionFrame> {
  const data = object(value)
  if (
    !data ||
    typeof data.jpeg !== "string" ||
    typeof data.at !== "number" ||
    !Number.isFinite(data.at) ||
    data.at < 0
  )
    throw new Error("frame")
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(data.jpeg))
    throw new Error("frame")
  const bytes = Buffer.from(data.jpeg.slice(23), "base64")
  if (bytes.length > IMAGE_LIMIT || bytes.length < 4) throw new Error("frame")
  const image = sharp(bytes, { limitInputPixels: 768 * 768, failOn: "warning" })
  const meta = await image.metadata()
  if (
    meta.format !== "jpeg" ||
    !meta.width ||
    !meta.height ||
    meta.width > 768 ||
    meta.height > 768 ||
    (meta.pages ?? 1) !== 1
  )
    throw new Error("frame")
  // Decode fully, and re-encode to strip metadata before leaving the server.
  const clean = await image.rotate().jpeg({ quality: 75 }).toBuffer()
  return {
    jpeg: `data:image/jpeg;base64,${clean.toString("base64")}`,
    at: data.at,
  }
}
async function archive(slug: string) {
  const [pending, posts] = await Promise.all([fetchPending(), fetchPosts()])
  const place = [...pending, ...posts].find((item) => item.slug === slug)
  if (!place || !place.b_imageUrl.startsWith("/posts/")) throw new Error("slug")
  const root = await realpath(path.join(process.cwd(), "public", "posts"))
  const file = await realpath(
    path.join(process.cwd(), "public", place.b_imageUrl)
  )
  if (!file.startsWith(root + path.sep)) throw new Error("slug")
  const bytes = await sharp(await readFile(file), {
    limitInputPixels: 40_000_000,
  })
    .rotate()
    .resize({
      width: 640,
      height: 640,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 75 })
    .toBuffer()
  return `data:image/jpeg;base64,${bytes.toString("base64")}`
}
const probability = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1

export async function POST(request: Request) {
  const started = Date.now()
  const reply = (
    outcome: DecisionResult["outcome"],
    status = 200,
    extra: Partial<DecisionResult> = {}
  ) =>
    Response.json(
      {
        action: "unknown",
        progress: "unknown",
        confidence: null,
        ms: Date.now() - started,
        outcome,
        ...extra,
      } satisfies DecisionResult,
      { status, headers: { "Cache-Control": "no-store" } }
    )
  if (process.env.TN_DECISIONS_EXPERIMENT !== "1") return reply("disabled", 404)
  // Next may normalize request.url to localhost behind its server. Compare
  // browser Origin against the actual Host, retaining the browser fetch guard.
  let origin: URL
  try {
    origin = new URL(request.headers.get("origin") ?? "")
  } catch {
    return reply("invalid", 403)
  }
  if (
    origin.host !== request.headers.get("host") ||
    !["http:", "https:"].includes(origin.protocol) ||
    request.headers.get("sec-fetch-site") !== "same-origin"
  )
    return reply("invalid", 403)
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply("invalid", 400)
  if (!allowed(request)) return reply("limited", 429)
  let current: DecisionFrame
  let previous: DecisionFrame | undefined
  let reference: string
  try {
    const body = object(await boundedJson(request.body, BODY_LIMIT))
    if (
      !body ||
      typeof body.slug !== "string" ||
      !/^[a-z0-9-]{1,120}$/.test(body.slug)
    )
      return reply("invalid", 400)
    current = await frame(body.current)
    if (body.previous !== undefined) {
      previous = await frame(body.previous)
      if (previous.at >= current.at || current.at - previous.at > 30_000)
        return reply("invalid", 400)
    }
    reference = await archive(body.slug)
  } catch {
    return reply("invalid", 400)
  }
  const key = process.env.OPENAI_API_KEY
  if (!key) return reply("unavailable", 503)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)
  const abort = () => controller.abort()
  request.signal.addEventListener("abort", abort, { once: true })
  if (request.signal.aborted) controller.abort()
  try {
    const content = [
      { type: "input_text", text: "Historical reference:" },
      { type: "input_image", image_url: reference },
      ...(previous
        ? [
            {
              type: "input_text",
              text: `Previous camera frame, timestamp ${previous.at}:`,
            },
            { type: "input_image", image_url: previous.jpeg },
          ]
        : []),
      {
        type: "input_text",
        text: `Current camera frame, timestamp ${current.at}:`,
      },
      { type: "input_image", image_url: current.jpeg },
    ]
    const response = await fetch("https://api.openai.com/v1/decisions", {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-6-luna",
        input: [
          { role: "developer", content: DECISION_INSTRUCTIONS },
          { role: "user", content },
        ],
        questions: [
          {
            type: "predicate",
            name: "evidence",
            instructions:
              "Are unchanged, clearly visible landmarks distributed across upper/lower and left/right parts of the principal subject sufficient to compare full-frame placement? A single patch or face, changed structures, ambiguity, or conflicting regional evidence means false.",
          },
          ...GEOMETRY_QUESTIONS,
          ...(previous
            ? [
                {
                  type: "choice",
                  name: "progress",
                  instructions:
                    "Compare CURRENT versus PREVIOUS full-frame placement relative to the reference using the same distributed unchanged landmarks. This describes visible difference only, not causation or movement compliance. If regions disagree or evidence is weak use unknown.",
                  choices: [
                    {
                      value: "better",
                      description:
                        "Current distributed landmark placement is clearly closer to reference.",
                    },
                    {
                      value: "same",
                      description:
                        "No discernible change in distributed landmark placement.",
                    },
                    {
                      value: "worse",
                      description:
                        "Current distributed landmark placement is clearly farther from reference.",
                    },
                    {
                      value: "unknown",
                      description: "Insufficient or contradictory evidence.",
                    },
                  ],
                },
              ]
            : []),
        ],
      }),
    })
    if (!response.ok) {
      await response.body?.cancel()
      return reply("unavailable", 502)
    }
    const result = object(await boundedJson(response.body, 32 * 1024))
    const answers = Array.isArray(result?.answers)
      ? result.answers.map(object)
      : []
    const find = (name: string) => answers.filter((a) => a?.name === name)
    const evidence = find("evidence")
    const supported =
      evidence.length === 1 &&
      evidence[0]?.type === "predicate" &&
      probability(evidence[0].probability) &&
      evidence[0].probability >= 0.8
    if (!supported) return reply("uncertain")
    const observations: Record<string, string> = {}
    const confidenceValues: number[] = [evidence[0]!.probability as number]
    for (const question of GEOMETRY_QUESTIONS) {
      const matches = find(question.name)
      const answer = matches[0]
      if (
        matches.length !== 1 ||
        answer?.type !== "choice" ||
        !probability(answer.confidence) ||
        answer.confidence < 0.8 ||
        typeof answer.choice !== "string" ||
        answer.choice === "unknown" ||
        !question.choices.some((c) => c.value === answer.choice)
      )
        return reply("uncertain")
      observations[question.name] = answer.choice
      confidenceValues.push(answer.confidence)
    }
    // Scale cannot distinguish focal length/crop from physical distance. Abstain.
    if (observations.scale !== "same") return reply("uncertain")
    const suggestions: CameraDecisionAction[] = []
    if (observations.horizontal !== "same")
      suggestions.push(
        observations.horizontal === "left" ? "aim_left" : "aim_right"
      )
    if (observations.vertical !== "same")
      suggestions.push(
        observations.vertical === "above" ? "aim_up" : "aim_down"
      )
    if (observations.roll !== "same")
      suggestions.unshift(
        observations.roll === "clockwise" ? "roll_right" : "roll_left"
      )
    // Correct roll first, then horizontal, then vertical; reassess next frame.
    const action = suggestions[0] ?? "hold"
    const progressAnswers = find("progress")
    const progress = progressAnswers[0]
    const progressValue: CameraDecisionProgress =
      previous &&
      progressAnswers.length === 1 &&
      progress?.type === "choice" &&
      probability(progress.confidence) &&
      progress.confidence >= 0.8 &&
      ["better", "same", "worse"].includes(progress.choice as string)
        ? (progress.choice as CameraDecisionProgress)
        : "unknown"
    return reply("ok", 200, {
      action,
      confidence: Math.min(...confidenceValues),
      progress: progressValue,
    })
  } catch {
    return reply(controller.signal.aborted ? "timeout" : "unavailable", 503)
  } finally {
    clearTimeout(timer)
    request.signal.removeEventListener("abort", abort)
  }
}
