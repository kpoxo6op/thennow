import type { Crop, Size } from "@/lib/rephoto/crop"

// Lining a new shot up with the archive photograph, done by an image-matching model (LoFTR) on
// the site's server. The model only says which spots in the two pictures show the same thing;
// the fit below turns that into one rotation, one zoom and one shift of a crop rectangle, so the
// photograph itself is never changed.

// Both pictures go to the model as grey 480x352 images; it answers per 8x8 cell.
export const MATCH_WIDTH = 480
export const MATCH_HEIGHT = 352
export const MATCH_CELL = 8
export const MATCH_BYTES = MATCH_WIDTH * MATCH_HEIGHT

// One matched spot: where it sits in the archive photograph and in the new one, each as a
// fraction of that picture's width and height.
export type Match = [u0: number, v0: number, u1: number, v1: number]

export type Fit = {
  crop: Crop
  // How many matched spots agree with the fit. Unrelated pictures reach about 10.
  inliers: number
}

// Fewer agreeing spots than this and the pictures are probably not of the same place.
export const MIN_INLIERS = 15

// Grey pixels of a picture squeezed to the size the model takes.
export function matchPixels(source: CanvasImageSource) {
  const canvas = document.createElement("canvas")
  canvas.width = MATCH_WIDTH
  canvas.height = MATCH_HEIGHT
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("No 2D canvas")
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.drawImage(source, 0, 0, MATCH_WIDTH, MATCH_HEIGHT)
  const { data } = context.getImageData(0, 0, MATCH_WIDTH, MATCH_HEIGHT)
  canvas.width = 0
  canvas.height = 0
  const gray = new Uint8Array(MATCH_BYTES)
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
    gray[i] = Math.round(
      0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]
    )
  }
  return gray
}

export async function requestMatches(
  then: Uint8Array,
  now: Uint8Array,
  signal?: AbortSignal
) {
  const body = new Uint8Array(MATCH_BYTES * 2)
  body.set(then, 0)
  body.set(now, MATCH_BYTES)
  const response = await fetch("/api/align", {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body,
    signal,
  })
  if (!response.ok) throw new Error(`Matching failed: ${response.status}`)
  const { matches } = (await response.json()) as { matches: Match[] }
  return matches
}

type Point = { x: number; y: number }
// p = [a -b; b a] q + t
type Similarity = { a: number; b: number; tx: number; ty: number }

function apply(t: Similarity, q: Point): Point {
  return { x: t.a * q.x - t.b * q.y + t.tx, y: t.b * q.x + t.a * q.y + t.ty }
}

// Least-squares similarity taking each q onto its p.
function leastSquares(qs: Point[], ps: Point[]): Similarity | null {
  const n = qs.length
  if (n < 2) return null
  let qx = 0,
    qy = 0,
    px = 0,
    py = 0
  for (let i = 0; i < n; i++) {
    qx += qs[i].x
    qy += qs[i].y
    px += ps[i].x
    py += ps[i].y
  }
  qx /= n
  qy /= n
  px /= n
  py /= n
  let dot = 0,
    cross = 0,
    norm = 0
  for (let i = 0; i < n; i++) {
    const x = qs[i].x - qx,
      y = qs[i].y - qy
    const u = ps[i].x - px,
      v = ps[i].y - py
    dot += x * u + y * v
    cross += x * v - y * u
    norm += x * x + y * y
  }
  if (norm < 1e-9) return null
  const a = dot / norm
  const b = cross / norm
  return { a, b, tx: px - (a * qx - b * qy), ty: py - (b * qx + a * qy) }
}

// Repeatable random numbers, so the same shot always gets the same fit.
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Finds the crop of the new photograph that shows the archive view: the rotation, zoom and shift
// that most matched spots agree on (RANSAC), refined over those spots. aspect is the archive
// photograph's height over width.
export function fitCrop(
  matches: Match[],
  aspect: number,
  photo: Size
): Fit | null {
  if (matches.length < MIN_INLIERS) return null
  // Archive points in units where its width is 1000, new-photo points in its pixels.
  const qs = matches.map(([u, v]) => ({ x: u * 1000, y: v * 1000 * aspect }))
  const ps = matches.map(([, , u, v]) => ({
    x: u * photo.width,
    y: v * photo.height,
  }))
  const threshold = photo.width * 0.00625
  const agreeing = (t: Similarity) => {
    const list: number[] = []
    for (let i = 0; i < qs.length; i++) {
      const p = apply(t, qs[i])
      if (Math.hypot(p.x - ps[i].x, p.y - ps[i].y) <= threshold) list.push(i)
    }
    return list
  }

  const next = random(7)
  let best: number[] = []
  for (let k = 0; k < 2000; k++) {
    const i = Math.floor(next() * qs.length)
    const j = Math.floor(next() * qs.length)
    if (i === j) continue
    const t = leastSquares([qs[i], qs[j]], [ps[i], ps[j]])
    if (!t) continue
    const list = agreeing(t)
    if (list.length > best.length) best = list
  }
  if (best.length < MIN_INLIERS) return null

  let fit: Similarity | null = null
  for (let round = 0; round < 3; round++) {
    fit = leastSquares(
      best.map((i) => qs[i]),
      best.map((i) => ps[i])
    )
    if (!fit) return null
    const list = agreeing(fit)
    if (list.length < MIN_INLIERS) return null
    best = list
  }
  if (!fit) return null

  const scale = Math.hypot(fit.a, fit.b)
  const rotation = Math.atan2(fit.b, fit.a)
  const centre = apply(fit, { x: 500, y: 500 * aspect })
  const crop = { cx: centre.x, cy: centre.y, width: scale * 1000, rotation }
  // A real rephotograph is nearly level and fills a fair part of the frame.
  if (Math.abs(rotation) > (25 * Math.PI) / 180) return null
  if (crop.width < photo.width * 0.15 || crop.width > photo.width * 2)
    return null

  return { crop, inliers: best.length }
}
