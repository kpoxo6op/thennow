import type { Size } from "@/lib/rephoto/crop"

// Following the picture between matches. The matcher takes a second or two on a phone; in
// between, a tiny grey copy of each frame is compared with the one the matcher looked at, and the
// old photograph is moved by however far the picture has slid. It only follows sliding (the hand
// panning or tilting), which is what a hand does in two seconds.

// The tiny copy's width; its height follows the picture's shape.
const WIDTH = 96
// How far the picture may slide between two looks, as a fraction of its width.
const MAX_SLIDE = 0.25
// Average difference per pixel, out of 255, above which the two copies are too unlike to trust.
const MAX_DIFFERENCE = 22

export type Thumb = { gray: Float32Array; width: number; height: number }

let canvas: HTMLCanvasElement | null = null

// A tiny grey copy of the picture, each pixel less the copy's mean, so a change of light doesn't
// read as a slide.
export function thumb(source: CanvasImageSource, photo: Size): Thumb | null {
  const width = WIDTH
  const height = Math.max(8, Math.round((photo.height / photo.width) * WIDTH))
  canvas ??= document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return null
  context.drawImage(source, 0, 0, width, height)
  const { data } = context.getImageData(0, 0, width, height)
  const gray = new Float32Array(width * height)
  let sum = 0
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
    gray[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]
    sum += gray[i]
  }
  const mean = sum / gray.length
  for (let i = 0; i < gray.length; i++) gray[i] -= mean
  return { gray, width, height }
}

// Half the size, for the first, coarse search.
function halve(t: Thumb): Thumb {
  const width = Math.floor(t.width / 2)
  const height = Math.floor(t.height / 2)
  const gray = new Float32Array(width * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = 2 * y * t.width + 2 * x
      gray[y * width + x] =
        (t.gray[i] +
          t.gray[i + 1] +
          t.gray[i + t.width] +
          t.gray[i + t.width + 1]) /
        4
    }
  return { gray, width, height }
}

// Mean difference when `now` is slid by (dx, dy) over `then`, over the part both cover; skips
// every other pixel, which is plenty to rank slides.
function difference(then: Thumb, now: Thumb, dx: number, dy: number) {
  const x0 = Math.max(0, dx)
  const x1 = Math.min(then.width, then.width + dx)
  const y0 = Math.max(0, dy)
  const y1 = Math.min(then.height, then.height + dy)
  let total = 0
  let count = 0
  for (let y = y0; y < y1; y += 2) {
    const a = y * then.width
    const b = (y - dy) * now.width - dx
    for (let x = x0; x < x1; x += 2) {
      total += Math.abs(then.gray[a + x] - now.gray[b + x])
      count++
    }
  }
  // Too little overlap to judge.
  return count < (then.width * then.height) / 16 ? Infinity : total / count
}

function search(
  then: Thumb,
  now: Thumb,
  cx: number,
  cy: number,
  radius: number
) {
  let best = { dx: cx, dy: cy, difference: Infinity }
  for (let dy = cy - radius; dy <= cy + radius; dy++)
    for (let dx = cx - radius; dx <= cx + radius; dx++) {
      const d = difference(then, now, dx, dy)
      if (d < best.difference) best = { dx, dy, difference: d }
    }
  return best
}

// How far a point in `then` has moved to reach the same spot in `now`, in fractions of the
// picture's width and height; null when the two can't be lined up with confidence.
export function slide(
  then: Thumb,
  now: Thumb
): { x: number; y: number } | null {
  if (then.width !== now.width || then.height !== now.height) return null
  const small = [halve(then), halve(now)] as const
  const radius = Math.ceil(small[0].width * MAX_SLIDE)
  const coarse = search(small[0], small[1], 0, 0, radius)
  if (!Number.isFinite(coarse.difference)) return null
  const fine = search(then, now, coarse.dx * 2, coarse.dy * 2, 2)
  if (fine.difference > MAX_DIFFERENCE) return null
  // `difference` slides `now` by (dx, dy) to sit on `then`: a point at p in `then` is at p - d now.
  return { x: -fine.dx / then.width || 0, y: -fine.dy / then.height || 0 }
}
