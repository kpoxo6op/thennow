import type { Crop } from "./crop"
import type { ReferenceLines } from "./reference-lines"

// Local image-space assistance, NOT a place recogniser or publication quality gate.
// Thresholds below bound the search and refuse weak/ambiguous evidence. They have
// not been calibrated as photographic precision against the manual reference pairs.
export type RegionEvidence = {
  name: string
  samples: number
  support: number
  residual: number | null
}
export type HandheldAssessment = {
  state: "searching" | "conflict" | "adjusted"
  crop: Crop | null
  regions: RegionEvidence[]
  supportedIndices: number[]
  worstFeatureIndex: number | null
  reason: string
}
type Raster = { width: number; height: number; gray: Float32Array }
type Sample = {
  x: number
  y: number
  nx: number
  ny: number
  sign: number
  feature: number
  region: string
  held: boolean
}
type Observation = { sample: Sample; offset: number; j: number[] }

function raster(image: ImageData): Raster {
  const gray = new Float32Array(image.width * image.height)
  for (let i = 0; i < gray.length; i++)
    gray[i] =
      (image.data[i * 4] * 0.299 +
        image.data[i * 4 + 1] * 0.587 +
        image.data[i * 4 + 2] * 0.114) /
      255
  return { width: image.width, height: image.height, gray }
}
function pixel(im: Raster, x: number, y: number) {
  if (x < 1 || y < 1 || x >= im.width - 2 || y >= im.height - 2) return NaN
  const ix = Math.floor(x),
    iy = Math.floor(y),
    dx = x - ix,
    dy = y - iy
  const at = iy * im.width + ix
  return (
    (1 - dy) * ((1 - dx) * im.gray[at] + dx * im.gray[at + 1]) +
    dy * ((1 - dx) * im.gray[at + im.width] + dx * im.gray[at + im.width + 1])
  )
}
function edge(im: Raster, x: number, y: number, nx: number, ny: number) {
  // Average along the tangent to avoid single-pixel noise voting as a building edge.
  let sum = 0
  for (let t = -1; t <= 1; t++)
    sum +=
      pixel(im, x + nx - ny * t, y + ny + nx * t) -
      pixel(im, x - nx - ny * t, y - ny + nx * t)
  return sum / 3
}
function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : Infinity
}
function solve(rows: Observation[]) {
  const a = Array.from({ length: 4 }, () => Array<number>(5).fill(0))
  for (const { j, offset } of rows) {
    const w = 1 / Math.max(1, Math.abs(offset) / 3)
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) a[r][c] += w * j[r] * j[c]
      a[r][4] += w * j[r] * offset
    }
  }
  for (let i = 0; i < 4; i++) {
    let pivot = i
    for (let r = i + 1; r < 4; r++)
      if (Math.abs(a[r][i]) > Math.abs(a[pivot][i])) pivot = r
    ;[a[i], a[pivot]] = [a[pivot], a[i]]
    if (Math.abs(a[i][i]) < 1e-6) return null
    const divisor = a[i][i]
    for (let c = i; c < 5; c++) a[i][c] /= divisor
    for (let r = 0; r < 4; r++)
      if (r !== i) {
        const factor = a[r][i]
        for (let c = i; c < 5; c++) a[r][c] -= factor * a[i][c]
      }
  }
  return a.map((row) => row[4])
}

// Both inputs must be downsampled consistently (recommended max dimension 640).
// Output crop is in photo pixels. Only explicitly region-labelled strokes vote;
// decorative traces, changed pavement and mural content remain visual guides.
export function assessHandheld(
  archive: ImageData,
  photo: ImageData,
  guide: ReferenceLines,
  seedCrop: Crop
): HandheldAssessment {
  const empty = (reason: string): HandheldAssessment => ({
    state: "searching",
    crop: null,
    regions: [],
    supportedIndices: [],
    worstFeatureIndex: null,
    reason,
  })
  if (
    ![seedCrop.cx, seedCrop.cy, seedCrop.width, seedCrop.rotation].every(
      Number.isFinite
    ) ||
    seedCrop.width <= 16
  )
    return empty("invalid_seed")
  const then = raster(archive),
    now = raster(photo)
  const aspect = archive.height / archive.width
  const samples: Sample[] = []
  guide.features.forEach((feature, fi) => {
    if (!feature.region) return
    for (let segment = 1; segment < feature.points.length; segment++) {
      const [u, v] = feature.points[segment - 1],
        [u2, v2] = feature.points[segment]
      const dx = (u2 - u) * archive.width,
        dy = (v2 - v) * archive.height
      const length = Math.hypot(dx, dy)
      if (length < 8) continue
      const nx = -dy / length,
        ny = dx / length
      const count = Math.min(40, Math.floor(length / 5))
      for (let i = 1; i < count; i++) {
        let x = u * archive.width + (dx * i) / count,
          y = v * archive.height + (dy * i) / count
        let strength = 0,
          snap = 0
        for (let d = -2; d <= 2; d++) {
          const value = edge(then, x + nx * d, y + ny * d, nx, ny)
          if (Math.abs(value) > Math.abs(strength)) {
            strength = value
            snap = d
          }
        }
        if (Math.abs(strength) < 0.055) continue
        x += nx * snap
        y += ny * snap
        // The reference itself must have a unique local edge, too. Repeated
        // window bars or a trace on a broad shading ramp cannot certify a match.
        let unique = true
        const referenceRadius = Math.max(3, Math.min(10, archive.width * 0.018))
        for (let d = -Math.floor(referenceRadius); d <= referenceRadius; d++) {
          const candidate =
            Math.sign(strength) * edge(then, x + nx * d, y + ny * d, nx, ny)
          if (
            candidate > Math.abs(strength) * 1.01 ||
            (Math.abs(d) > 3 && candidate > Math.abs(strength) * 0.8)
          )
            unique = false
        }
        if (!unique) continue
        samples.push({
          x: x / archive.width - 0.5,
          y: y / archive.width - aspect / 2,
          nx,
          ny,
          sign: Math.sign(strength),
          feature: fi,
          region: feature.region,
          held: i % 2 === 0,
        })
      }
    }
  })
  if (samples.length < 18) return empty("insufficient_archive_edges")
  const radius = Math.max(3, Math.min(10, photo.width * 0.018))
  const observe = (crop: Crop): Observation[] => {
    const cos = Math.cos(crop.rotation),
      sin = Math.sin(crop.rotation)
    const rows: Observation[] = []
    for (const sample of samples) {
      const qx = crop.width * (cos * sample.x - sin * sample.y),
        qy = crop.width * (sin * sample.x + cos * sample.y)
      const nx = cos * sample.nx - sin * sample.ny,
        ny = sin * sample.nx + cos * sample.ny
      const scores: { d: number; strength: number }[] = []
      for (let d = -Math.floor(radius); d <= radius; d++) {
        const strength =
          sample.sign *
          edge(now, crop.cx + qx + nx * d, crop.cy + qy + ny * d, nx, ny)
        if (Number.isFinite(strength)) scores.push({ d, strength })
      }
      scores.sort((a, b) => b.strength - a.strength)
      const best = scores[0]
      if (
        !best ||
        best.strength < 0.055 ||
        Math.abs(best.d) >= Math.floor(radius)
      )
        continue
      const competitor = scores.find((s) => Math.abs(s.d - best.d) > 3)
      if (competitor && competitor.strength > best.strength * 0.8) continue
      rows.push({
        sample,
        offset: best.d,
        j: [nx, ny, nx * qx + ny * qy, -nx * qy + ny * qx],
      })
    }
    return rows
  }
  let crop = { ...seedCrop }
  for (let iteration = 0; iteration < 4; iteration++) {
    const rows = observe(crop).filter((row) => !row.sample.held)
    if (rows.length < 10) return empty("insufficient_unique_edges")
    const delta = solve(rows)
    if (!delta) return empty("unconstrained_geometry")
    crop = {
      cx: crop.cx + delta[0],
      cy: crop.cy + delta[1],
      width: crop.width * (1 + delta[2]),
      rotation: crop.rotation + delta[3],
    }
    if (
      Math.hypot(crop.cx - seedCrop.cx, crop.cy - seedCrop.cy) >
        seedCrop.width * 0.03 ||
      Math.abs(crop.width / seedCrop.width - 1) > 0.03 ||
      Math.abs(crop.rotation - seedCrop.rotation) > Math.PI / 90
    )
      return empty("outside_local_search")
  }
  const held = observe(crop).filter((row) => row.sample.held)
  const names = [
    ...new Set(
      guide.features.flatMap((feature) =>
        feature.region ? [feature.region] : []
      )
    ),
  ]
  const regions = names.map((name) => {
    const expected = samples.filter((s) => s.held && s.region === name).length
    const found = held.filter((row) => row.sample.region === name)
    return {
      name,
      samples: expected,
      support: found.length,
      residual: found.length
        ? median(found.map((row) => Math.abs(row.offset)))
        : null,
    }
  })
  const supportedIndices = guide.features.flatMap((_, fi) => {
    const expected = samples.filter((s) => s.held && s.feature === fi).length
    const found = held.filter((row) => row.sample.feature === fi)
    return expected >= 3 &&
      found.length >= Math.max(3, expected * 0.55) &&
      median(found.map((row) => Math.abs(row.offset))) <= 2
      ? [fi]
      : []
  })
  const worst = guide.features
    .flatMap((feature, fi) => {
      const found = held.filter((row) => row.sample.feature === fi)
      return feature.region && found.length >= 3
        ? [{ fi, score: median(found.map((row) => Math.abs(row.offset))) }]
        : []
    })
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => b.score - a.score)[0]
  const enough =
    regions.length >= 2 &&
    regions.every((r) => r.support >= Math.max(3, r.samples * 0.55)) &&
    supportedIndices.length >= 3
  const conflict = regions.some(
    (r) => r.support >= 3 && r.residual !== null && r.residual > 2
  )
  return {
    state: conflict ? "conflict" : enough ? "adjusted" : "searching",
    crop: enough && !conflict ? crop : null,
    regions,
    supportedIndices,
    worstFeatureIndex: worst?.fi ?? null,
    reason: conflict
      ? "regional_disagreement"
      : enough
        ? "local_edges_supported_unverified"
        : "missing_or_changed_edges",
  }
}
