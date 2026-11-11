import { expect, test } from "@playwright/test"

import { slide, type Thumb } from "@/lib/rephoto/track"

// A made-up scene with plenty of detail, seen through a 96 x 72 window placed at (ox, oy).
function view(ox: number, oy: number, noise = 0): Thumb {
  const width = 96
  const height = 72
  const gray = new Float32Array(width * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const u = x + ox
      const v = y + oy
      gray[y * width + x] =
        60 * Math.sin(u / 5) * Math.cos(v / 7) +
        40 * Math.sin((u + 2 * v) / 11) +
        (noise
          ? (Math.abs(Math.sin(x * 12.9898 + y * 78.233)) * 43758.5453) % noise
          : 0)
    }
  return { gray, width, height }
}

// Independent known translation, not an expected value computed with slide().
test("tracking recovers a known pan despite sensor noise", () => {
  const by = slide(view(0, 0), view(-6, 3, 8))!
  expect(by.x).toBeCloseTo(6 / 96, 5)
  expect(by.y).toBeCloseTo(-3 / 72, 5)
})

test("tracking refuses scenes without an unambiguous displacement", () => {
  const plain = { width: 96, height: 72, gray: new Float32Array(96 * 72) }
  expect(slide(plain, plain)).toBeNull()
  const fence = {
    ...plain,
    gray: Float32Array.from(plain.gray, (_, i) => (i % 8 < 4 ? 50 : -50)),
  }
  expect(slide(fence, fence)).toBeNull()
  const unrelated = {
    ...view(0, 0),
    gray: view(0, 0).gray.map((g, i) => (i % 7) * 30 - g),
  }
  expect(slide(view(0, 0), unrelated)).toBeNull()
})
