import type { Match } from "@/lib/rephoto/match"

// Where to stand, from parallax. Turning the phone or zooming moves near and far things alike;
// stepping moves near things more. So the far part of the view (shops down the street) is fitted
// on its own with one rotation, zoom and shift, and whatever the near part (the corner wall)
// still does after that says how the phone stands relative to the old photographer:
//
// - near things too big against far ones: too close, step back
// - near things shifted left: standing too far right, step left
// - near things shifted down: holding the phone too high, lower it
//
// Each place says which part of its old photo is near and which is far (`zones`, fractions of
// the archive). Without enough matches in both, nothing is said.

export type Zone = [x0: number, y0: number, x1: number, y1: number]
export type Zones = { near: Zone; far: Zone }
export type Step = {
  // Fractions of the view's width the near part is off by, after the far part is lined up.
  sideways: number
  height: number
  // Relative size of the near part against the far part, minus one.
  depth: number
  near: number
  far: number
}

type Similarity = { a: number; b: number; tx: number; ty: number }
const apply = (s: Similarity, x: number, y: number) => ({
  x: s.a * x - s.b * y + s.tx,
  y: s.b * x + s.a * y + s.ty,
})

function leastSquares(
  q: { x: number; y: number }[],
  p: { x: number; y: number }[]
): Similarity | null {
  const n = q.length
  if (n < 2) return null
  let qx = 0,
    qy = 0,
    px = 0,
    py = 0
  for (let i = 0; i < n; i++) {
    qx += q[i].x
    qy += q[i].y
    px += p[i].x
    py += p[i].y
  }
  qx /= n
  qy /= n
  px /= n
  py /= n
  let sa = 0,
    sb = 0,
    sq = 0
  for (let i = 0; i < n; i++) {
    const ux = q[i].x - qx,
      uy = q[i].y - qy,
      vx = p[i].x - px,
      vy = p[i].y - py
    sa += ux * vx + uy * vy
    sb += ux * vy - uy * vx
    sq += ux * ux + uy * uy
  }
  if (sq < 1e-9) return null
  const a = sa / sq,
    b = sb / sq
  return { a, b, tx: px - (a * qx - b * qy), ty: py - (b * qx + a * qy) }
}

// A rotation, zoom and shift most matches agree on (RANSAC, then refit on the agreeing ones).
function robustSimilarity(
  q: { x: number; y: number }[],
  p: { x: number; y: number }[],
  threshold: number
) {
  let seed = 7
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  let best: number[] = []
  for (let k = 0; k < 400; k++) {
    const i = Math.floor(random() * q.length)
    const j = Math.floor(random() * q.length)
    if (i === j) continue
    const s = leastSquares([q[i], q[j]], [p[i], p[j]])
    if (!s) continue
    const list: number[] = []
    for (let m = 0; m < q.length; m++) {
      const r = apply(s, q[m].x, q[m].y)
      if (Math.hypot(r.x - p[m].x, r.y - p[m].y) <= threshold) list.push(m)
    }
    if (list.length > best.length) best = list
  }
  if (best.length < 2) return null
  return {
    fit: leastSquares(
      best.map((i) => q[i]),
      best.map((i) => p[i])
    ),
    inliers: best,
  }
}

const inside = ([x0, y0, x1, y1]: Zone, u: number, v: number) =>
  u >= x0 && u <= x1 && v >= y0 && v <= y1

// `matches` are archive/photo fractions; `photo` the photo's size in pixels; `cell` one model cell
// in photo pixels (the matches' precision).
export function parallaxStep(
  matches: Match[],
  zones: Zones,
  photo: { width: number; height: number },
  cell: number,
  // The archive's height over its width.
  aspect: number
): Step | null {
  // Archive in units where its width is 1000; photo in pixels.
  const near = matches.filter(([u, v]) => inside(zones.near, u, v))
  const far = matches.filter(([u, v]) => inside(zones.far, u, v))
  if (near.length < 25 || far.length < 25) return null
  const toQ = ([u, v]: Match) => ({ x: u * 1000, y: v * 1000 * aspect })
  const toP = ([, , u, v]: Match) => ({
    x: u * photo.width,
    y: v * photo.height,
  })
  const farFit = robustSimilarity(far.map(toQ), far.map(toP), cell * 0.75)
  if (!farFit?.fit || farFit.inliers.length < 20) return null
  const s = farFit.fit
  const scale = Math.hypot(s.a, s.b)
  // The archive view's width in the photo, for expressing everything as a fraction of it.
  const view = scale * 1000
  // Near matches that agree among themselves (a near-only fit), so stray matches don't vote.
  const nearFit = robustSimilarity(near.map(toQ), near.map(toP), cell * 0.75)
  if (!nearFit?.fit || nearFit.inliers.length < 20) return null
  // Residual of each near match after the far fit: r = k (p - c) + t, c the near part's centre.
  const pts = nearFit.inliers.map((i) => {
    const q = toQ(near[i])
    const p = toP(near[i])
    const predicted = apply(s, q.x, q.y)
    return {
      x: predicted.x,
      y: predicted.y,
      rx: p.x - predicted.x,
      ry: p.y - predicted.y,
    }
  })
  // Solve r = k (p - c) + t with c the middle of the picture (where the camera points): a step
  // forward grows things about that point, a step sideways shifts them.
  const cx = photo.width / 2
  const cy = photo.height / 2
  // Normal equations for (k, tx, ty).
  let sdd = 0,
    sdx = 0,
    sdy = 0,
    sr = 0,
    srx = 0,
    sry = 0
  for (const p of pts) {
    const dx = p.x - cx,
      dy = p.y - cy
    sdd += dx * dx + dy * dy
    sdx += dx
    sdy += dy
    sr += dx * p.rx + dy * p.ry
    srx += p.rx
    sry += p.ry
  }
  const n = pts.length
  // [sdd sdx sdy; sdx n 0; sdy 0 n] [k tx ty] = [sr srx sry]
  const det = sdd * n * n - sdx * sdx * n - sdy * sdy * n
  if (Math.abs(det) < 1e-6) return null
  const k = (sr * n * n - sdx * srx * n - sdy * sry * n) / det
  const tx = (srx - k * sdx) / n
  const ty = (sry - k * sdy) / n
  return {
    sideways: tx / view,
    height: ty / view,
    depth: k,
    near: nearFit.inliers.length,
    far: farFit.inliers.length,
  }
}
