// Match a complete traced contour by translating patches along it together.
// Repetition along a straight edge leaves its sideways position unconstrained.
import type { Crop } from "./crop"
import type { Gray, LineVerdict } from "./line-check"

type Point = [number, number]
const offsets: Point[] = [
  [-5, -5],
  [0, -5],
  [5, -5],
  [-5, 0],
  [0, 0],
  [5, 0],
  [-5, 5],
  [0, 5],
  [5, 5],
  [-2, -2],
  [2, -2],
  [-2, 2],
  [2, 2],
]
type Patch = { x: number; y: number; nx: number; ny: number; values: number[] }

export function matchContour(
  points: Point[],
  archive: Gray,
  live: Gray,
  crop: Crop
): Pick<LineVerdict, "state" | "shift" | "support" | "offset"> | null {
  const w = archive.width,
    h = archive.height
  const scale = crop.width / w,
    cs = Math.cos(crop.rotation),
    sn = Math.sin(crop.rotation)
  const anchors = points.map(([x, y]) => [x * w, y * h] as Point)
  const lengths = anchors
    .slice(1)
    .map(([x, y], i) => Math.hypot(x - anchors[i][0], y - anchors[i][1]))
  const length = lengths.reduce((a, b) => a + b, 0)
  if (length < 4) return null
  const count = Math.min(24, Math.max(6, Math.ceil(length / 6)))
  const patches: Patch[] = []
  let seg = 0,
    start = 0
  for (let i = 0; i < count; i++) {
    const pos = ((i + 0.5) * length) / count
    while (seg < lengths.length - 1 && start + lengths[seg] < pos)
      start += lengths[seg++]
    if (!lengths[seg]) continue
    const tx = (anchors[seg + 1][0] - anchors[seg][0]) / lengths[seg]
    const ty = (anchors[seg + 1][1] - anchors[seg][1]) / lengths[seg]
    const x = Math.round(anchors[seg][0] + (pos - start) * tx),
      y = Math.round(anchors[seg][1] + (pos - start) * ty)
    if (x < 5 || y < 5 || x >= w - 5 || y >= h - 5) continue
    const values = offsets.map(
      ([dx, dy]) => archive.data[(y + dy) * w + x + dx]
    )
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const norm = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0))
    if (norm < 0.032 * Math.sqrt(values.length)) continue
    patches.push({
      x: Math.round(crop.cx + scale * (cs * (x - w / 2) - sn * (y - h / 2))),
      y: Math.round(crop.cy + scale * (sn * (x - w / 2) + cs * (y - h / 2))),
      nx: -ty,
      ny: tx,
      values: values.map((v) => (v - mean) / norm),
    })
  }
  if (patches.length < 4 || patches.length < count * 0.45) return null
  const locations = offsets.map(
    ([dx, dy]) =>
      Math.round(scale * (sn * dx + cs * dy)) * live.width +
      Math.round(scale * (cs * dx - sn * dy))
  )
  const margin = Math.round(scale * 5 * (Math.abs(cs) + Math.abs(sn)))
  const reach = Math.round(crop.width * 0.1),
    stride = Math.max(2, Math.round(crop.width / 120))
  function score(dx: number, dy: number) {
    let sum = 0,
      good = 0
    for (const p of patches) {
      const x = p.x + dx,
        y = p.y + dy
      if (
        x < margin ||
        x >= live.width - margin ||
        y < margin ||
        y >= live.height - margin
      )
        continue
      let dot = 0,
        mean = 0,
        sq = 0
      const base = y * live.width + x
      for (let j = 0; j < locations.length; j++) {
        const v = live.data[base + locations[j]]
        dot += v * p.values[j]
        mean += v
        sq += v * v
      }
      const variance = sq - (mean * mean) / locations.length
      if (variance < 0.0004 * locations.length) continue
      const similarity = dot / Math.sqrt(variance)
      if (similarity > 0.65) good++
      sum += Math.max(0, similarity)
    }
    return good >= patches.length * 0.62 ? sum / patches.length : 0
  }
  const candidates: { dx: number; dy: number; score: number }[] = []
  let best = { dx: 0, dy: 0, score: score(0, 0) }
  function consider(dx: number, dy: number) {
    const raw = score(dx, dy)
    // Only break near-ties in favour of less movement.
    const value = raw - 0.0002 * Math.hypot(dx, dy)
    const result = { dx, dy, score: value }
    if (value > 0.6) candidates.push(result)
    if (value > best.score) best = result
  }
  const radius = Math.floor(reach / stride) * stride
  for (let dy = -radius; dy <= radius; dy += stride)
    for (let dx = -radius; dx <= radius; dx += stride) consider(dx, dy)
  if (best.score < 0.61) return null
  const coarse = best
  for (let dy = coarse.dy - stride; dy <= coarse.dy + stride; dy++)
    for (let dx = coarse.dx - stride; dx <= coarse.dx + stride; dx++)
      consider(dx, dy)
  if (
    best.score < 0.82 ||
    Math.max(Math.abs(best.dx), Math.abs(best.dy)) >= reach - 1
  )
    return null
  // For a straight contour only the component across it is observable.
  // For a corner or curve the normals span two dimensions.
  let xx = 0,
    xy = 0
  for (const p of patches) {
    xx += p.nx * p.nx
    xy += p.nx * p.ny
  }
  xx /= patches.length
  xy /= patches.length
  const angle = 0.5 * Math.atan2(2 * xy, 2 * xx - 1) + crop.rotation
  const nx = Math.cos(angle),
    ny = Math.sin(angle)
  const straight = Math.hypot(xx - 0.5, xy) > 0.42
  const distance = (x: number, y: number) =>
    straight ? Math.abs(x * nx + y * ny) : Math.hypot(x, y)
  if (
    candidates.some(
      (c) =>
        distance(c.dx - best.dx, c.dy - best.dy) >
          Math.max(5, 0.018 * crop.width) && c.score > best.score - 0.065
    )
  )
    return null
  const normal = best.dx * nx + best.dy * ny
  const dx = straight ? normal * nx : best.dx,
    dy = straight ? normal * ny : best.dy
  const offset = Math.hypot(dx, dy) / crop.width
  return {
    state: offset <= 0.01 ? "on" : offset > 0.015 ? "off" : "unknown",
    offset,
    support: best.score,
    shift:
      offset > 0.015
        ? [(cs * dx + sn * dy) / crop.width, (-sn * dx + cs * dy) / (h * scale)]
        : undefined,
  }
}
