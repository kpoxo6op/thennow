// Directional chamfer matching: finds where an archive photograph sits inside a camera frame,
// as a similarity transform (scale, rotation, shift). Nothing here changes a pixel.
//
// Each photograph is reduced to thin edges with a direction. An archive edge point scores by how
// far it lands from a frame edge running the same way, capped, so a building that went or a tree
// that grew costs a fixed amount and cannot drag the fit. Only the best-agreeing share of points
// counts (a trimmed mean), so decades of change in part of the view are tolerated.
//
// Coordinates are in units of each image's own width, so the transform holds at any resolution:
// an archive point q, measured from the archive photograph's centre, lands in the frame at
// p = scale * R(rotation) * q + (tx, ty), with (0, 0) the frame's top left corner.

export type Gray = { data: Float32Array; width: number; height: number }

export type Similarity = {
  // The archive photograph's width as a fraction of the frame's width.
  scale: number
  // Radians, positive turns clockwise on screen.
  rotation: number
  tx: number
  ty: number
}

export type Alignment = {
  transform: Similarity
  // 0 to 1: the trimmed share of archive edges that found a matching frame edge nearby.
  score: number
  // How far the best fit stands above the best clearly different one.
  margin: number
  // How evenly the matching edges spread over the archive photograph, 0 to 1.
  coverage: number
  // How many standard deviations the coarse peak stands above the searched placements.
  peak: number
  locked: boolean
}

const BINS = 12

type EdgeMap = {
  width: number
  height: number
  // Distance to the nearest edge per direction bin, capped at CAP.
  distance: Float32Array[]
}

type Points = {
  qx: Float32Array
  qy: Float32Array
  angle: Float32Array
  cell: Uint8Array
  count: number
}

export type Reference = { aspect: number; coarse: Points; fine: Points }
export type Frame = { aspect: number; coarse: EdgeMap; fine: EdgeMap }

export const FRAME_WIDTH = 320
const COARSE_FRAME_WIDTH = 160
const CAP = 6
const GRID = 4

export function resize(source: Gray, width: number): Gray {
  const scale = source.width / width
  const height = Math.max(1, Math.round(source.height / scale))
  const data = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * scale)
    const y1 = Math.min(source.height, Math.max(y0 + 1, Math.floor((y + 1) * scale)))
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * scale)
      const x1 = Math.min(source.width, Math.max(x0 + 1, Math.floor((x + 1) * scale)))
      let sum = 0
      for (let sy = y0; sy < y1; sy++) {
        const row = sy * source.width
        for (let sx = x0; sx < x1; sx++) sum += source.data[row + sx]
      }
      data[y * width + x] = sum / ((y1 - y0) * (x1 - x0))
    }
  }
  return { data, width, height }
}

function blur(values: Float32Array, width: number, height: number) {
  const temp = new Float32Array(values.length)
  const out = new Float32Array(values.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const l = values[y * width + Math.max(0, x - 1)]
      const r = values[y * width + Math.min(width - 1, x + 1)]
      temp[y * width + x] = (l + 2 * values[y * width + x] + r) / 4
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = temp[Math.max(0, y - 1) * width + x]
      const d = temp[Math.min(height - 1, y + 1) * width + x]
      out[y * width + x] = (u + 2 * temp[y * width + x] + d) / 4
    }
  }
  return out
}

type Edges = { width: number; height: number; strength: Float32Array; angle: Float32Array }

// Thin edges: gradient maxima across the edge, kept where neighbours agree in direction
// (rooflines and kerbs do; foliage, grass and cloud texture do not), strongest share only.
function findEdges(image: Gray, keep: number): Edges {
  const { width, height } = image
  const source = blur(blur(image.data, width, height), width, height)
  const gx = new Float32Array(width * height)
  const gy = new Float32Array(width * height)
  const magnitude = new Float32Array(width * height)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const at = y * width + x
      const dx =
        source[at - width + 1] + 2 * source[at + 1] + source[at + width + 1] -
        source[at - width - 1] - 2 * source[at - 1] - source[at + width - 1]
      const dy =
        source[at + width - 1] + 2 * source[at + width] + source[at + width + 1] -
        source[at - width - 1] - 2 * source[at - width] - source[at - width + 1]
      gx[at] = dx
      gy[at] = dy
      magnitude[at] = Math.hypot(dx, dy)
    }
  }

  // Direction agreement over a small window, on doubled angles so opposite polarity agrees.
  const cx = new Float32Array(width * height)
  const cy = new Float32Array(width * height)
  for (let at = 0; at < cx.length; at++) {
    const m = magnitude[at]
    if (m > 0) {
      cx[at] = (gx[at] * gx[at] - gy[at] * gy[at]) / m
      cy[at] = (2 * gx[at] * gy[at]) / m
    }
  }
  const bx = blur(blur(cx, width, height), width, height)
  const by = blur(blur(cy, width, height), width, height)
  const bm = blur(blur(magnitude, width, height), width, height)

  const strength = new Float32Array(width * height)
  const angle = new Float32Array(width * height)
  const candidates: number[] = []
  const margin = 2
  for (let y = margin; y < height - margin; y++) {
    for (let x = margin; x < width - margin; x++) {
      const at = y * width + x
      const m = magnitude[at]
      if (m <= 0) continue
      // Step one pixel across the edge both ways; keep only the peak.
      const ux = gx[at] / m
      const uy = gy[at] / m
      const ax = Math.round(x + ux)
      const ay = Math.round(y + uy)
      const bxp = Math.round(x - ux)
      const byp = Math.round(y - uy)
      if (magnitude[ay * width + ax] > m || magnitude[byp * width + bxp] >= m) continue
      const coherence = bm[at] > 0 ? Math.hypot(bx[at], by[at]) / bm[at] : 0
      const s = m * coherence * coherence
      strength[at] = s
      // Edge direction along the edge, folded to [0, pi).
      let a = Math.atan2(gy[at], gx[at]) + Math.PI / 2
      a = ((a % Math.PI) + Math.PI) % Math.PI
      angle[at] = a
      candidates.push(s)
    }
  }
  candidates.sort((p, q) => q - p)
  const threshold = candidates[Math.min(candidates.length - 1, Math.floor(width * height * keep))] ?? 0
  for (let at = 0; at < strength.length; at++) {
    if (strength[at] <= threshold) strength[at] = 0
  }
  return { width, height, strength, angle }
}

function binOf(angle: number) {
  return Math.floor((((angle % Math.PI) + Math.PI) % Math.PI) / (Math.PI / BINS)) % BINS
}

function distanceMaps(edges: Edges): EdgeMap {
  const { width, height } = edges
  const distance: Float32Array[] = []
  for (let bin = 0; bin < BINS; bin++) {
    const d = new Float32Array(width * height).fill(CAP)
    for (let at = 0; at < d.length; at++) {
      if (edges.strength[at] <= 0) continue
      const b = binOf(edges.angle[at])
      // An edge counts for its own direction and the two beside it.
      const off = (b - bin + BINS) % BINS
      if (off === 0 || off === 1 || off === BINS - 1) d[at] = 0
    }
    const diagonal = Math.SQRT2
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const at = y * width + x
        let v = d[at]
        if (x > 0) v = Math.min(v, d[at - 1] + 1)
        if (y > 0) {
          v = Math.min(v, d[at - width] + 1)
          if (x > 0) v = Math.min(v, d[at - width - 1] + diagonal)
          if (x < width - 1) v = Math.min(v, d[at - width + 1] + diagonal)
        }
        d[at] = v
      }
    }
    for (let y = height - 1; y >= 0; y--) {
      for (let x = width - 1; x >= 0; x--) {
        const at = y * width + x
        let v = d[at]
        if (x < width - 1) v = Math.min(v, d[at + 1] + 1)
        if (y < height - 1) {
          v = Math.min(v, d[at + width] + 1)
          if (x < width - 1) v = Math.min(v, d[at + width + 1] + diagonal)
          if (x > 0) v = Math.min(v, d[at + width - 1] + diagonal)
        }
        d[at] = v
      }
    }
    distance.push(d)
  }
  return { width, height, distance }
}

function pickPoints(image: Gray, limit: number): Points {
  const edges = findEdges(image, 0.08)
  const { width, height } = edges
  // Scans carry borders, scratches and captions at the edges.
  const margin = Math.round(width * 0.04)
  const cellSize = Math.max(3, Math.round(Math.sqrt((width * height) / (limit * 1.6))))
  const chosen: { at: number; s: number }[] = []
  for (let cy = margin; cy < height - margin; cy += cellSize) {
    for (let cx = margin; cx < width - margin; cx += cellSize) {
      let best = -1
      let bestS = 0
      for (let y = cy; y < Math.min(height - margin, cy + cellSize); y++) {
        for (let x = cx; x < Math.min(width - margin, cx + cellSize); x++) {
          const s = edges.strength[y * width + x]
          if (s > bestS) {
            bestS = s
            best = y * width + x
          }
        }
      }
      if (best >= 0) chosen.push({ at: best, s: bestS })
    }
  }
  chosen.sort((a, b) => b.s - a.s)
  const kept = chosen.slice(0, limit)
  const points: Points = {
    qx: new Float32Array(kept.length),
    qy: new Float32Array(kept.length),
    angle: new Float32Array(kept.length),
    cell: new Uint8Array(kept.length),
    count: kept.length,
  }
  kept.forEach(({ at }, n) => {
    const x = at % width
    const y = Math.floor(at / width)
    points.qx[n] = (x + 0.5 - width / 2) / width
    points.qy[n] = (y + 0.5 - height / 2) / width
    points.angle[n] = edges.angle[at]
    points.cell[n] = Math.min(GRID - 1, Math.floor((y / height) * GRID)) * GRID + Math.min(GRID - 1, Math.floor((x / width) * GRID))
  })
  return points
}

export function prepareReference(image: Gray): Reference {
  return {
    aspect: image.height / image.width,
    coarse: pickPoints(resize(image, Math.min(image.width, 140)), 220),
    fine: pickPoints(resize(image, Math.min(image.width, 300)), 700),
  }
}

export function prepareFrame(image: Gray): Frame {
  const fine = image.width === FRAME_WIDTH ? image : resize(image, FRAME_WIDTH)
  return {
    aspect: fine.height / fine.width,
    coarse: distanceMaps(findEdges(resize(fine, COARSE_FRAME_WIDTH), 0.1)),
    fine: distanceMaps(findEdges(fine, 0.1)),
  }
}

const TRIM = 0.6
const MIN_INSIDE = 0.6

type Evaluation = { value: number; coverage: number }

const costs = new Float32Array(4096)
const cells = new Uint8Array(GRID * GRID)

// 0 to 1: how close the best-agreeing share of archive edges land to frame edges running the
// same way. Points off the frame count as misses.
function evaluate(points: Points, map: EdgeMap, t: Similarity): Evaluation {
  const { width, height } = map
  const cos = Math.cos(t.rotation) * t.scale * width
  const sin = Math.sin(t.rotation) * t.scale * width
  const ox = t.tx * width - 0.5
  const oy = t.ty * width - 0.5
  let inside = 0
  const n = points.count
  for (let i = 0; i < n; i++) {
    const x = Math.round(cos * points.qx[i] - sin * points.qy[i] + ox)
    const y = Math.round(sin * points.qx[i] + cos * points.qy[i] + oy)
    if (x < 0 || y < 0 || x >= width || y >= height) {
      costs[i] = CAP
      continue
    }
    inside++
    costs[i] = map.distance[binOf(points.angle[i] + t.rotation)][y * width + x]
  }
  if (inside < n * MIN_INSIDE) return { value: 0, coverage: 0 }

  // Trimmed mean: the closest share of points, by a counting sort on the capped distances.
  const keep = Math.max(1, Math.floor(n * TRIM))
  const buckets = new Uint16Array(CAP * 4 + 1)
  for (let i = 0; i < n; i++) buckets[Math.min(CAP * 4, Math.round(costs[i] * 4))]++
  let taken = 0
  let total = 0
  for (let b = 0; b <= CAP * 4 && taken < keep; b++) {
    const use = Math.min(buckets[b], keep - taken)
    total += use * (b / 4)
    taken += use
  }
  const value = 1 - total / keep / CAP

  cells.fill(0)
  for (let i = 0; i < n; i++) if (costs[i] <= 1.5) cells[points.cell[i]] = 1
  let covered = 0
  for (let c = 0; c < cells.length; c++) covered += cells[c]
  return { value, coverage: covered / cells.length }
}

const DEG = Math.PI / 180

type Candidate = { t: Similarity; value: number }

function isNear(a: Similarity, b: Similarity) {
  return (
    Math.abs(Math.log(a.scale / b.scale)) < 0.06 &&
    Math.hypot(a.tx - b.tx, a.ty - b.ty) < Math.max(a.scale, b.scale) * 0.05 &&
    Math.abs(a.rotation - b.rotation) < 2.5 * DEG
  )
}

export const SEARCH = {
  // How far the automatic fit may wander from the person's own framing.
  scaleRange: 0.16,
  turnRange: 5 * DEG,
  shiftRange: 0.12,
}

let spread = { mean: 0, std: 1 }

function search(ref: Reference, frame: Frame, around: Similarity): Candidate[] {
  const map = frame.coarse
  const step = 1.5 / map.width
  const found: Candidate[] = []
  for (let s = -SEARCH.scaleRange; s <= SEARCH.scaleRange + 1e-9; s += 0.04) {
    const scale = around.scale * Math.exp(s)
    for (let r = -SEARCH.turnRange; r <= SEARCH.turnRange + 1e-9; r += 1.25 * DEG) {
      const rotation = around.rotation + r
      const reach = SEARCH.shiftRange * scale
      for (let dy = -reach; dy <= reach; dy += step) {
        for (let dx = -reach; dx <= reach; dx += step) {
          const t = { scale, rotation, tx: around.tx + dx, ty: around.ty + dy }
          const { value } = evaluate(ref.coarse, map, t)
          if (value > 0) found.push({ t, value })
        }
      }
    }
  }
  let sum = 0
  let sq = 0
  for (const f of found) {
    sum += f.value
    sq += f.value * f.value
  }
  const mean = sum / Math.max(1, found.length)
  spread = { mean, std: Math.sqrt(Math.max(1e-9, sq / Math.max(1, found.length) - mean * mean)) }
  found.sort((a, b) => b.value - a.value)
  const distinct: Candidate[] = []
  for (const candidate of found) {
    if (distinct.every((other) => !isNear(other.t, candidate.t))) {
      distinct.push(candidate)
      if (distinct.length >= 6) break
    }
  }
  return distinct
}

function refine(points: Points, map: EdgeMap, start: Similarity): Candidate {
  let best = start
  let bestValue = evaluate(points, map, best).value
  let move = 1 / map.width
  let zoom = 0.012
  let turn = 0.5 * DEG
  for (let round = 0; round < 4; round++) {
    for (let guard = 0; guard < 10; guard++) {
      let improved = false
      const tries: Similarity[] = [
        { ...best, tx: best.tx + move },
        { ...best, tx: best.tx - move },
        { ...best, ty: best.ty + move },
        { ...best, ty: best.ty - move },
        { ...best, scale: best.scale * (1 + zoom) },
        { ...best, scale: best.scale / (1 + zoom) },
        { ...best, rotation: best.rotation + turn },
        { ...best, rotation: best.rotation - turn },
      ]
      for (const t of tries) {
        const { value } = evaluate(points, map, t)
        if (value > bestValue) {
          bestValue = value
          best = t
          improved = true
        }
      }
      if (!improved) break
    }
    move /= 2
    zoom /= 2
    turn /= 2
  }
  return { t: best, value: bestValue }
}

export const LOCK = { score: 0.55, margin: 0.03, coverage: 0.4 }

// Searches near the framing the person chose (the prior); never far from it.
export function align(ref: Reference, frame: Frame, prior: Similarity): Alignment | null {
  const candidates = search(ref, frame, prior)
  if (!candidates.length) return null
  const refined = candidates.map((c) => refine(ref.fine, frame.fine, c.t)).sort((a, b) => b.value - a.value)
  const best = refined[0]
  const rival = refined.find((other) => !isNear(other.t, best.t))
  const margin = rival ? best.value - rival.value : best.value
  const { coverage } = evaluate(ref.fine, frame.fine, best.t)
  const peak = (candidates[0].value - spread.mean) / spread.std
  return {
    peak,
    transform: best.t,
    score: best.value,
    margin,
    coverage,
    locked: best.value >= LOCK.score && margin >= LOCK.margin && coverage >= LOCK.coverage,
  }
}

export function scoreAt(ref: Reference, frame: Frame, t: Similarity) {
  return { coarse: evaluate(ref.coarse, frame.coarse, t).value, fine: evaluate(ref.fine, frame.fine, t).value }
}

export function footprint(t: Similarity, aspect: number) {
  const cos = Math.cos(t.rotation) * t.scale
  const sin = Math.sin(t.rotation) * t.scale
  const h = aspect / 2
  return [
    [-0.5, -h],
    [0.5, -h],
    [0.5, h],
    [-0.5, h],
  ].map(([x, y]) => ({ x: cos * x - sin * y + t.tx, y: sin * x + cos * y + t.ty }))
}
