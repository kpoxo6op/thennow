import type { Crop } from "@/lib/rephoto/crop"
import type { ReferenceLines } from "@/lib/rephoto/reference-lines"

import { matchContour } from "./contour.ts"

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
  // Whether the line takes part (has a region): decorative lines never count.
  votes: boolean
  distinctive?: boolean
  // Where the line's edge sits in the live picture relative to the line, as fractions of the old
  // photo's width and height, when its points agree on it.
  shift?: [number, number]
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
  sign = 0,
  // Where the edge should be (the old photo's offset) and how near counts as there.
  expect = 0,
  tolerance = -1
) {
  let best = 0
  let bestD = 0
  let bestSign = 0
  const scores: [number, number][] = []
  for (let d = -reach; d <= reach; d++) {
    const raw = edge(g, x + nx * d, y + ny * d, nx, ny)
    if (!Number.isFinite(raw)) continue
    const s = sign ? raw * sign : Math.abs(raw)
    scores.push([d, s])
    if (s > best) {
      best = s
      bestD = d
      bestSign = Math.sign(raw)
    }
  }
  if (best < MIN_EDGE || Math.abs(bestD) >= reach - 1) return null
  // A clear edge where the line should be, beaten by a stronger one further off (a shadow's edge
  // in sun, the lettering on a new sign), can't say the line is off: the stronger edge may be
  // something else. Seen at Bradley Lane, 16 Nov 2026: the wall's foot in shade, the pavement's
  // shadow line 6% below it.
  if (tolerance >= 0 && Math.abs(bestD - expect) > tolerance) {
    let near = 0
    for (const [d, s] of scores)
      if (Math.abs(d - expect) <= tolerance) near = Math.max(near, s)
    if (near >= Math.max(MIN_EDGE, best * 0.4)) return null
  }
  for (const [d, s] of scores)
    if (Math.abs(d - bestD) > 3 && s > best * 0.8) return null
  return { d: bestD, sign: bestSign }
}

// How far (in live pixels, across the line) the patch of the old photo around a point best
// matches the live picture: a strip a little along the line and wider across it, compared with
// zero-mean correlation, so it goes by the whole local pattern (the mural's paint above the foot
// of a wall, a sign's lettering) rather than by one edge that sun or a new sign may have moved.
// Null when no shift matches well, or two shifts apart match about as well.
function patchShift(
  archive: Gray,
  live: Gray,
  x: number,
  y: number,
  nx: number,
  ny: number,
  lx: number,
  ly: number,
  lnx: number,
  lny: number,
  scale: number,
  reach: number,
  // Also look along the line: only for lines whose own pattern pins them that way (a sign's
  // lettering). Elsewhere a changed patch (a new sign over a wall's top) "finds" a false shift.
  pinned = false,
  minimum = 0.5
) {
  const T = 6
  const N = 10
  const a: number[] = []
  for (let t = -T; t <= T; t += 2)
    for (let n = -N; n <= N; n++) {
      const v = at(archive, x + nx * n - ny * t, y + ny * n + nx * t)
      if (!Number.isFinite(v)) return null
      a.push(v)
    }
  const mean = a.reduce((sum, v) => sum + v, 0) / a.length
  let norm = 0
  for (let i = 0; i < a.length; i++) {
    a[i] -= mean
    norm += a[i] * a[i]
  }
  if (norm < a.length * 0.0015) return null
  // Correlation with the live patch moved d across the line and e along it (live pixels).
  const ncc = (d: number, e: number) => {
    const b: number[] = []
    for (let t = -T; t <= T; t += 2)
      for (let n = -N; n <= N; n++) {
        const across = n * scale + d
        const along = t * scale + e
        const v = at(
          live,
          lx + lnx * across - lny * along,
          ly + lny * across + lnx * along
        )
        if (!Number.isFinite(v)) return NaN
        b.push(v)
      }
    const bm = b.reduce((sum, v) => sum + v, 0) / b.length
    let dot = 0
    let bn = 0
    for (let i = 0; i < b.length; i++) {
      const v = b[i] - bm
      dot += a[i] * v
      bn += v * v
    }
    return bn > 1e-9 ? dot / Math.sqrt(norm * bn) : 0
  }
  const scores: [number, number][] = []
  let best = -1
  let bestD = 0
  for (let d = -reach; d <= reach; d++) {
    const value = ncc(d, 0)
    if (!Number.isFinite(value)) continue
    scores.push([d, value])
    if (value > best) {
      best = value
      bestD = d
    }
  }
  if (best < minimum || Math.abs(bestD) >= reach - 1) return null
  for (const [d, value] of scores)
    if (Math.abs(d - bestD) > 3 && value > best - 0.05) return null
  // Along the line, too, where the pattern pins it (a sign's lettering): a sign moved sideways
  // keeps its top and bottom edges on their lines, so across alone can't see it (Bradley Lane's
  // TAKEAWAY 5% off on 14-15 Nov). A plain edge doesn't pin it and counts as on.
  if (!pinned) return { d: bestD, e: 0, quality: best }
  let bestE = 0
  let bestAlong = best
  const along: [number, number][] = []
  for (let e = -reach; e <= reach; e += 2) {
    const value = ncc(bestD, e)
    if (!Number.isFinite(value)) continue
    along.push([e, value])
    if (value > bestAlong + 0.03) {
      bestAlong = value
      bestE = e
    }
  }
  if (
    bestE !== 0 &&
    along.some(
      ([e, value]) => Math.abs(e - bestE) > 4 && value > bestAlong - 0.05
    )
  )
    bestE = 0
  return { d: bestD, e: bestE, quality: best }
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
  crop: Crop,
  recognized = true
): LineCheck {
  const w = archive.width
  const h = archive.height
  const scale = crop.width / w
  const cos = Math.cos(crop.rotation)
  const sin = Math.sin(crop.rotation)
  const reach = Math.max(4, Math.round(REACH * w))
  const lines: LineVerdict[] = guide.features.map((feature, index) => {
    const votes = !!feature.region
    const contour = matchContour(feature.points, archive, live, crop)
    if (contour) return { index, votes, distinctive: true, ...contour }
    const unknown = {
      index,
      state: "unknown" as const,
      offset: null,
      support: 0,
      votes,
    }
    // Offsets in thirds of the line, so one matching stretch can't hide the rest.
    const sections: number[][] = [[], [], []]
    const moves: [number, number][] = []
    let total = 0,
      unique = 0
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
      if (length < 3) {
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

        samples++
        const qx = (x - w / 2) * scale
        const qy = (y - h / 2) * scale
        const lx = crop.cx + cos * qx - sin * qy
        const ly = crop.cy + sin * qx + cos * qy
        const lnx = cos * nx - sin * ny
        const lny = sin * nx + cos * ny
        let shift = patchShift(
          archive,
          live,
          x,
          y,
          nx,
          ny,
          lx,
          ly,
          lnx,
          lny,
          scale,
          Math.round(reach * scale),
          !!feature.along,
          recognized && votes ? 0.5 : 0.8
        )
        if (shift && (shift.quality ?? 0) >= 0.8) unique++
        // Where the surroundings changed too much for the patch to match (a 1929 photo against
        // today's colours), the single clear edge still can, provided nothing near the line's
        // place competes with it.
        if (shift == null && recognized && votes && then) {
          const edgeNow = strongest(
            live,
            lx,
            ly,
            lnx,
            lny,
            Math.round(reach * scale),
            then.sign,
            then.d * scale,
            Math.max(2, LINE_ON * w * scale)
          )
          if (edgeNow)
            shift = { d: edgeNow.d - then.d * scale, e: 0, quality: 0 }
        }
        if (shift == null) continue
        total++
        const along = (walked + length * t) / Math.max(1, whole)
        sections[Math.min(2, Math.floor(along * 3))].push(
          Math.hypot(shift.d, shift.e) / scale
        )
        // Where this point's edge is in the live picture, in old-photo pixels.
        moves.push([
          (nx * shift.d - ny * shift.e) / scale,
          (ny * shift.d + nx * shift.e) / scale,
        ])
      }
      walked += length
    }
    const support = samples ? total / samples : 0
    const filled = sections.filter((section) => section.length >= 2)
    // A short line (a roof hip, a building corner) is judged on fewer points and may fill
    // only one third with two of them; a long one still needs two thirds.
    const short = whole < w * 0.12
    if (
      samples < (short ? 4 : 6) ||
      support < MIN_SUPPORT ||
      filled.length < (short ? 1 : 2)
    )
      return { ...unknown, support }
    const offset = Math.max(
      ...filled.map((section) => Math.abs(median(section)) / w)
    )
    // The line's whole shift, shown as a dashed copy where its edge really is: only when most
    // points agree on the way it moved, so a stray match can't draw a confident wrong copy.
    const mx = median(moves.map(([x]) => x))
    const my = median(moves.map(([, y]) => y))
    const agree =
      moves.filter(([x, y]) => x * mx + y * my > 0).length / moves.length
    const coherent =
      support >= 0.6 && agree >= 0.7 && Math.hypot(mx, my) / w > LINE_ON
    const distinctive = unique >= 3 && unique >= total * 0.6
    // A scene lock cannot identify this particular edge. A plain regional
    // landmark needs multiple samples agreeing on its own displacement.
    const inliers = moves.filter(
      ([x, y]) => Math.hypot(x - mx, y - my) <= LINE_ON * w
    ).length
    if (
      !distinctive &&
      (!recognized ||
        !votes ||
        inliers < Math.max(4, 0.7 * total) ||
        inliers < 0.4 * samples)
    ) {
      return { ...unknown, support }
    }
    if (offset > LINE_OFF && !coherent) return { ...unknown, support }
    return {
      index,
      distinctive,
      state: offset <= LINE_ON ? "on" : offset > LINE_OFF ? "off" : "unknown",
      offset,
      support,
      votes,
      shift: coherent ? [mx / w, my / h] : undefined,
    }
  })
  const off = lines
    .filter((line) => line.votes && line.state === "off")
    .sort((a, b) => (b.offset ?? 0) - (a.offset ?? 0))
  const voting = guide.features.flatMap((feature, index) =>
    feature.region ? [index] : []
  )
  const regions = new Set(
    voting.map((index) => guide.features[index].region ?? "all")
  )
  const confirmed = new Set(
    lines
      .filter((line) => line.votes && line.state === "on")
      .map((line) => guide.features[line.index].region ?? "all")
  )
  return {
    ok:
      voting.length >= 2 &&
      off.length === 0 &&
      !lines.some((l) => l.distinctive && l.state === "off" && l.shift) &&
      [...regions].every((region) => confirmed.has(region)),
    lines,
    worst: off[0]?.index ?? null,
  }
}

// How well a view lines up, as a score out of 100 the person can watch climb, the same live and
// after the shot. Each region (a wall, a shopfront, a sign) scores the mean of its measured lines:
// on its edge counts 1, 3% of the view's width off or more counts 0 (19 Nov: at 5%, lines 2% off still scored 81). The score is the mean over
// the regions that could be measured, so a wall that fits can't hide a shopfront that doesn't,
// and lines that can't be seen don't drag it (they are reported as coverage instead).
export type Score = {
  score: number
  // Regions measured, out of all regions with lines.
  measured: number
  regions: number
  // The weakest measured region's score.
  weakest: number
  // Lines measured.
  lines: number
}
export function alignmentScore(
  check: LineCheck,
  guide: { features: { region?: string }[] }
): Score | null {
  const byRegion = new Map<string, number[]>()
  let lines = 0
  const all = new Set<string>()
  for (const line of check.lines) {
    if (!line.votes) continue
    const region = guide.features[line.index].region ?? "all"
    all.add(region)
    if (line.offset == null) continue
    lines++
    const value = Math.min(1, Math.max(0, 1 - (line.offset - LINE_ON) / 0.02))
    byRegion.set(region, [...(byRegion.get(region) ?? []), value])
  }
  if (!byRegion.size) return null
  const regionScores = [...byRegion.values()].map(
    (values) => values.reduce((a, b) => a + b, 0) / values.length
  )
  return {
    score: Math.round(
      (100 * regionScores.reduce((a, b) => a + b, 0)) / regionScores.length
    ),
    measured: byRegion.size,
    regions: all.size,
    weakest: Math.round(100 * Math.min(...regionScores)),
    lines,
  }
}

// Enough measured to trust the number: three lines over two regions (fewer where a place has
// fewer regions).
export function scoreUsable(score: Score | null): score is Score {
  return (
    !!score &&
    // Three lines, or two where a place has only two parts left to check (St Heliers).
    score.lines >= Math.min(3, Math.max(2, score.regions)) &&
    score.measured >= Math.min(2, score.regions)
  )
}

// "Lined up": a high score, every region measured, none clearly off (a line 3% away scores 50). Set below Boris's
// own 18:04 shot at Bradley Lane (16 Nov 2026), which looked right line for line and scored 84.
export const LINED_UP = { enter: 80, stay: 72, region: 50 }
export function linedUp(score: Score | null, already: boolean) {
  if (!scoreUsable(score)) return false
  // Every region seen: a wall that fits can't vouch for a sign nobody could measure.
  if (score.measured < score.regions) return false
  if (score.weakest < LINED_UP.region) return false
  return score.score >= (already ? LINED_UP.stay : LINED_UP.enter)
}
