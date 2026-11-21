import { expect, test } from "@playwright/test"

import { fits, nudgeInside } from "@/lib/rephoto/crop"

// The shot keeps what the screen showed: a crop hanging a little off the photo slides back in
// by exactly its overhang, keeping its size, rather than falling back to the centre.
const photo = { width: 4032, height: 3024 }
const aspect = 2 / 3

test("a crop 2% over the left edge slides in by the overhang only", () => {
  const crop = { cx: 1600, cy: 1400, width: 3200 + 160, rotation: 0 }
  const out = nudgeInside(crop, aspect, photo)
  expect(fits(out, aspect, photo)).toBe(true)
  expect(out.width).toBeCloseTo(crop.width, 6)
  // Left edge was at 1600 - 1680 = -80: it moves right by 80, nothing else changes.
  expect(out.cx).toBeCloseTo(1680, 6)
  expect(out.cy).toBeCloseTo(1400, 6)
})

test("a crop that fits is kept exactly", () => {
  const crop = { cx: 2000, cy: 1500, width: 3000, rotation: 0.02 }
  expect(nudgeInside(crop, aspect, photo)).toEqual(crop)
})

test("a crop wider than the photo is centred and shrunk to fit", () => {
  const out = nudgeInside(
    { cx: 1500, cy: 1500, width: 4400, rotation: 0 },
    aspect,
    photo
  )
  expect(fits(out, aspect, photo)).toBe(true)
  expect(out.width).toBeLessThanOrEqual(4032)
})
