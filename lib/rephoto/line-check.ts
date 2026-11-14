import type { Crop } from "@/lib/rephoto/crop"
import type { ReferenceLines } from "@/lib/rephoto/reference-lines"

// Whether each reference line really sits on its edge in the live picture, once the old photo's
// view is placed by `crop`. One rotation, zoom and shift can fit the wall and still leave the
// canopy off when the shot is taken from a different spot (Bradley Lane, 14 Nov 2026: "Lined up"
// with the canopy line well above the verandah). So "lined up" needs every line checked.
//
// For points along a line, the strongest edge across it is looked for in the live picture and,
// at the same scale, in the old photo; the difference is how far off that point is. Comparing
// with the old photo forgives a line drawn a little beside its edge.

export type Gray = { width: number; height: number; data: Float32Array }
export type LineVerdict = {
  index: number
  state: "on" | "off" | "unknown"
  // Median distance off, as a fraction of the view's width (worst third of the line).
  offset: number | null
  support: number
}
export type LineCheck = {
  ok: boolean
  lines: LineVerdict[]
  worst: number | null
}

// A line is on its edge within ON of the view's width, off beyond OFF; between, unknown.
export const LINE_ON = 0.01
export const LINE_OFF = 0.015
// Points must find a clear edge for a line to be judged at all.
const MIN_SUPPORT = 0.4
// How far across the line the edge is looked for, as a fraction of the view's width.
const REACH = 0.06
// Weakest edge (out of 1 in grey) a point may rely on.
const MIN_EDGE = 0.05

function at(g: Gray, x: number, y: number) {
  if (x < 1 || y < 1 || x >= g.width - 2 || y >= g.height - 2) return NaN
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const dx = x - ix
  const dy = y - iy
  const i = iy * g.width + ix
  const d = g.data
  return (
    (1 - dy) * ((1 - dx) * d[i] + dx * d[i + 1]) +
    dy * ((1 - dx) * d[i + g.width] + dx * d[i + g.width + 1])
  )
}

// Signed edge strength across the line at (x, y), averaged a little along it.
function edge(g: Gray, x: number, y: number, nx: number, ny: number) {
  let sum = 0
  for (let t = -2; t <= 2; t++) {
    const px = x - ny * t
    const py = y + nx * t
    sum += at(g, px + nx, py + ny) - at(g, px - nx, py - ny)
  }
  return sum / 5
}

// The one clear edge near (x, y): its offset along the normal and its sign. Null when it is too
// faint, at the end of the search (the real edge may be further), or has a rival nearly as
// strong further off (a fascia's top and bottom, window bars).
function strongest(
  g: Gray,
  x: number,
  y: number,
  nx: number,
  ny: number,
  reach: number,
  sign = 0
) {
  let best = 0
  let bestD = 0
  let bestSign = 0
  const scores: [number, number][] = []
  for (let d = -reach; d <= reach; d++) {
    const raw = edge(g, x + nx * d, y + ny * d, nx, ny)
    if (!Number.isFinite(raw)) return null
    const s = sign ? raw * sign : Math.abs(raw)
    scores.push([d, s])
    if (s > best) {
      best = s
      bestD = d
      bestSign = Math.sign(raw)
    }
  }
  if (best < MIN_EDGE || Math.abs(bestD) >= reach - 1) return null
  for (const [d, s] of scores)
    if (Math.abs(d - bestD) > 3 && s > best * 0.8) return null
  return { d: bestD, sign: bestSign }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

// `archive` is the old photo scaled to `width` pixels across (the view's width in `live`);
// `crop` places that view in `live`'s pixels. Only lines given a region (a wall, a canopy) take
// part: decorative guides on a mural or a changed sign can't vouch for anything. Every region
// must have a line confirmed on its edge, and no line may be off, for the shot to count as
// lined up; anything that can't be checked counts against it.
export function checkLines(
  guide: ReferenceLines,
  archive: Gray,
  live: Gray,
  crop: Crop
): LineCheck {
  const w = archive.width
  const h = archive.height
  const scale = crop.width / w
  const cos = Math.cos(crop.rotation)
  const sin = Math.sin(crop.rotation)
  const reach = Math.max(4, Math.round(REACH * w))
  const anyRegion = guide.features.some((feature) => feature.region)
  const lines: LineVerdict[] = guide.features.map((feature, index) => {
    if (anyRegion && !feature.region)
      return { index, state: "unknown", offset: null, support: 0 }
    // Offsets in thirds of the line, so one matching stretch can't hide the rest.
    const sections: number[][] = [[], [], []]
    let total = 0
    const lengths = feature.points.slice(1).map((p, k) => {
      const q = feature.points[k]
      return Math.hypot((p[0] - q[0]) * w, (p[1] - q[1]) * h)
    })
    const whole = lengths.reduce((a, b) => a + b, 0)
    let walked = 0
    let samples = 0
    for (let k = 1; k < feature.points.length; k++) {
      const [u0, v0] = feature.points[k - 1]
      const [u1, v1] = feature.points[k]
      const ax = u0 * w
      const ay = v0 * h
      const bx = u1 * w
      const by = v1 * h
      const length = lengths[k - 1]
      if (length < 10) {
        walked += length
        continue
      }
      const nx = -(by - ay) / length
      const ny = (bx - ax) / length
      const count = Math.max(3, Math.min(30, Math.floor(length / 6)))
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count
        const x = ax + (bx - ax) * t
        const y = ay + (by - ay) * t
        const then = strongest(archive, x, y, nx, ny, reach)
        if (!then) continue
        samples++
        const qx = (x - w / 2) * scale
        const qy = (y - h / 2) * scale
        const now = strongest(
          live,
          crop.cx + cos * qx - sin * qy,
          crop.cy + sin * qx + cos * qy,
          cos * nx - sin * ny,
          sin * nx + cos * ny,
          Math.round(reach * scale),
          then.sign
        )
        if (!now) continue
        total++
        const along = (walked + length * t) / Math.max(1, whole)
        sections[Math.min(2, Math.floor(along * 3))].push(
          now.d / scale - then.d
        )
      }
      walked += length
    }
    const support = samples ? total / samples : 0
    const filled = sections.filter((section) => section.length >= 2)
    if (samples < 6 || support < MIN_SUPPORT || filled.length < 2)
      return { index, state: "unknown", offset: null, support }
    const offset = Math.max(
      ...filled.map((section) => Math.abs(median(section)) / w)
    )
    return {
      index,
      state: offset <= LINE_ON ? "on" : offset > LINE_OFF ? "off" : "unknown",
      offset,
      support,
    }
  })
  const off = lines
    .filter((line) => line.state === "off")
    .sort((a, b) => (b.offset ?? 0) - (a.offset ?? 0))
  const voting = guide.features.flatMap((feature, index) =>
    !anyRegion || feature.region ? [index] : []
  )
  const regions = new Set(
    voting.map((index) => guide.features[index].region ?? "all")
  )
  const confirmed = new Set(
    lines
      .filter((line) => line.state === "on")
      .map((line) => guide.features[line.index].region ?? "all")
  )
  return {
    ok:
      voting.length >= 2 &&
      off.length === 0 &&
      [...regions].every((region) => confirmed.has(region)),
    lines,
    worst: off[0]?.index ?? null,
  }
}
