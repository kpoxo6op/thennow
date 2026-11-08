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
// Served from public/ for phones that run the model themselves, and read by the server route.
export const MODEL_PATH = "/models/loftr-coarse-352x480-fp16.onnx"
const MIN_CONFIDENCE = 0.2

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
// How far, in model cells, a matched spot may sit from the fit and still agree with it.
const INLIER_CELLS = 0.6

// Where a picture sits inside the model's 480x352 input, as fractions of that input.
export type Placement = { x: number; y: number; width: number; height: number }

// Grey pixels of a picture fitted, at its own shape, into the size the model takes. The rest is
// mid-grey, so an upright shot isn't squashed into a landscape one.
export function matchPixels(
  source: CanvasImageSource,
  width: number,
  height: number
) {
  const scale = Math.min(MATCH_WIDTH / width, MATCH_HEIGHT / height)
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const left = Math.floor((MATCH_WIDTH - w) / 2)
  const top = Math.floor((MATCH_HEIGHT - h) / 2)

  // Halving a few times first: Safari scales down in one rough step otherwise.
  let image: CanvasImageSource = source
  let iw = width
  let ih = height
  const steps: HTMLCanvasElement[] = []
  while (iw / 2 >= w * 1.5) {
    const step = document.createElement("canvas")
    step.width = Math.round(iw / 2)
    step.height = Math.round(ih / 2)
    const context = step.getContext("2d")
    if (!context) break
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(image, 0, 0, step.width, step.height)
    image = step
    iw = step.width
    ih = step.height
    steps.push(step)
  }

  const canvas = document.createElement("canvas")
  canvas.width = MATCH_WIDTH
  canvas.height = MATCH_HEIGHT
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("No 2D canvas")
  context.fillStyle = "rgb(128,128,128)"
  context.fillRect(0, 0, MATCH_WIDTH, MATCH_HEIGHT)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.drawImage(image, left, top, w, h)
  const { data } = context.getImageData(0, 0, MATCH_WIDTH, MATCH_HEIGHT)
  for (const step of [...steps, canvas]) {
    step.width = 0
    step.height = 0
  }
  const gray = new Uint8Array(MATCH_BYTES)
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
    gray[i] = Math.round(
      0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]
    )
  }
  const placement: Placement = {
    x: left / MATCH_WIDTH,
    y: top / MATCH_HEIGHT,
    width: w / MATCH_WIDTH,
    height: h / MATCH_HEIGHT,
  }
  return { gray, placement }
}

// Turns matches in model-input fractions into fractions of each picture, dropping any that fall
// in the grey border.
// Size in the new photograph's pixels of one model cell, given where the photograph sat.
export function cellSize(photo: Size, placement: Placement) {
  return (photo.width / (placement.width * MATCH_WIDTH)) * MATCH_CELL
}

export function unplace(
  matches: Match[],
  then: Placement,
  now: Placement
): Match[] {
  const inside = (u: number, v: number, p: Placement) =>
    u >= p.x && u <= p.x + p.width && v >= p.y && v <= p.y + p.height
  return matches
    .filter(([u0, v0, u1, v1]) => inside(u0, v0, then) && inside(u1, v1, now))
    .map(([u0, v0, u1, v1]) => [
      (u0 - then.x) / then.width,
      (v0 - then.y) / then.height,
      (u1 - now.x) / now.width,
      (v1 - now.y) / now.height,
    ])
}

// A cell stands for the pixel at its top-left corner (8 x index), as in LoFTR itself: each
// stride-2 layer of its backbone is centred on 2 x index.
// The model answers, for each cell of the archive picture, its best cell in the new one, how sure
// it is, and whether the two cells pick each other. Confident mutual pairs become matches.
export function cellsToMatches(
  best: ArrayLike<number | bigint>,
  confidence: ArrayLike<number>,
  mutual: ArrayLike<number>
): Match[] {
  const columns = MATCH_WIDTH / MATCH_CELL
  const rows = MATCH_HEIGHT / MATCH_CELL
  const round = (n: number) => Math.round(n * 10000) / 10000
  const matches: Match[] = []
  for (let i = 0; i < confidence.length; i++) {
    if (mutual[i] <= 0 || confidence[i] <= MIN_CONFIDENCE) continue
    const j = Number(best[i])
    matches.push([
      round(((i % columns) * MATCH_CELL + 0.5) / MATCH_WIDTH),
      round((Math.floor(i / columns) * MATCH_CELL + 0.5) / MATCH_HEIGHT),
      round(((j % columns) * MATCH_CELL + 0.5) / MATCH_WIDTH),
      round((Math.floor(j / columns) * MATCH_CELL + 0.5) / MATCH_HEIGHT),
    ])
  }
  return matches
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

// Share of the crop rectangle that lies on the photograph.
function coverage(crop: Crop, aspect: number, photo: Size) {
  const cos = Math.cos(crop.rotation)
  const sin = Math.sin(crop.rotation)
  const n = 20
  let inside = 0
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      const x = ((a + 0.5) / n - 0.5) * crop.width
      const y = ((b + 0.5) / n - 0.5) * crop.width * aspect
      const px = crop.cx + cos * x - sin * y
      const py = crop.cy + sin * x + cos * y
      if (px >= 0 && py >= 0 && px <= photo.width && py <= photo.height)
        inside++
    }
  }
  return inside / (n * n)
}

// Finds the crop of the new photograph that shows the archive view: the rotation, zoom and shift
// that most matched spots agree on (RANSAC), refined over those spots. aspect is the archive
// photograph's height over width.
// cell is the size, in the new photograph's pixels, of one of the model's 8x8 cells: matches can
// only be that precise, so agreement is judged against it.
export function fitCrop(
  matches: Match[],
  aspect: number,
  photo: Size,
  cell: number
): Fit | null {
  if (matches.length < MIN_INLIERS) return null
  // Archive points in units where its width is 1000, new-photo points in its pixels.
  const qs = matches.map(([u, v]) => ({ x: u * 1000, y: v * 1000 * aspect }))
  const ps = matches.map(([, , u, v]) => ({
    x: u * photo.width,
    y: v * photo.height,
  }))
  const threshold = cell * INLIER_CELLS
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

  // Agreement from one small patch (a repeated window, a single gable) isn't a match of the view.
  const xs = best.map((i) => qs[i].x)
  const ys = best.map((i) => qs[i].y)
  const spanX = (Math.max(...xs) - Math.min(...xs)) / 1000
  const spanY = (Math.max(...ys) - Math.min(...ys)) / (1000 * aspect)
  if (spanX < 0.3 || spanY < 0.2) return null
  // Most of the archive view must be in the shot; a few black corners are fine.
  if (coverage(crop, aspect, photo) < 0.75) return null

  return { crop, inliers: best.length }
}
