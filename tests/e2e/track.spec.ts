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

test.describe("following the picture between matches", () => {
  test("a still picture hasn't slid", () => {
    expect(slide(view(0, 0), view(0, 0))).toEqual({ x: 0, y: 0 })
  })

  test("a pan to the right moves the old view left by as much", () => {
    // The window moved 10 right and 4 down, so the scene moved 10 left and 4 up in it.
    const by = slide(view(0, 0), view(10, 4))!
    expect(by.x).toBeCloseTo(-10 / 96, 5)
    expect(by.y).toBeCloseTo(-4 / 72, 5)
  })

  test("a little sensor noise doesn't throw it off", () => {
    const by = slide(view(0, 0), view(-6, 3, 8))!
    expect(by.x).toBeCloseTo(6 / 96, 5)
    expect(by.y).toBeCloseTo(-3 / 72, 5)
  })

  test("a different scene isn't followed", () => {
    const other: Thumb = {
      ...view(0, 0),
      gray: view(0, 0).gray.map((g, i) => (i % 7) * 30 - g),
    }
    expect(slide(view(0, 0), other)).toBeNull()
  })
})

test.describe("following, when it can't be sure", () => {
  test("a plain picture (sky, a wall) isn't followed", () => {
    const plain: Thumb = {
      width: 96,
      height: 72,
      gray: new Float32Array(96 * 72),
    }
    expect(slide(plain, plain)).toBeNull()
  })

  test("repeating detail (a fence) isn't followed", () => {
    const fence = (ox: number): Thumb => {
      const gray = new Float32Array(96 * 72)
      for (let y = 0; y < 72; y++)
        for (let x = 0; x < 96; x++)
          gray[y * 96 + x] = (x + ox) % 8 < 4 ? 50 : -50
      return { width: 96, height: 72, gray }
    }
    expect(slide(fence(0), fence(0))).toBeNull()
  })
})
