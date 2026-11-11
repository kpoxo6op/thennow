import { expect, test } from "@playwright/test"

import { zoomed, zoomFor } from "@/lib/rephoto/zoom"

const photo = { width: 4000, height: 3000 }
const aspect = 0.75
const range = { min: 1, max: 30 }

// These are mathematical safety checks, not evidence that a camera obeys a zoom request.
test("zoom preserves the photographed rectangle and never requests more than 2x", () => {
  const small = { cx: 2000, cy: 1500, width: 800, rotation: 0 }
  expect(zoomFor(small, aspect, photo, 1, range)).toBe(2)
  const crop = { cx: 2000, cy: 1500, width: 2600, rotation: 0.05 }
  const zoom = zoomFor(crop, aspect, photo, 1, range)!
  expect(zoom).toBeGreaterThan(1)
  expect(zoom).toBeLessThan(2)
  const view = zoomed(crop, photo, zoom)
  // Compute the rotated rectangle's extents independently of the production fits() helper.
  const halfW = (view.width * 1.1) / 2
  const halfH = halfW * aspect
  const dx =
    Math.abs(Math.cos(view.rotation)) * halfW +
    Math.abs(Math.sin(view.rotation)) * halfH
  const dy =
    Math.abs(Math.sin(view.rotation)) * halfW +
    Math.abs(Math.cos(view.rotation)) * halfH
  expect(view.cx - dx).toBeGreaterThanOrEqual(0)
  expect(view.cx + dx).toBeLessThanOrEqual(photo.width)
  expect(view.cy - dy).toBeGreaterThanOrEqual(0)
  expect(view.cy + dy).toBeLessThanOrEqual(photo.height)
})

test("an unsupported zoom is refused and an overflowing view backs out", () => {
  const small = { cx: 2000, cy: 1500, width: 800, rotation: 0 }
  expect(zoomFor(small, aspect, photo, 1, { min: 1, max: 1 })).toBeNull()
  const crop = { ...small, width: 4100 }
  const zoom = zoomFor(crop, aspect, photo, 2, range)!
  expect(zoom).toBeGreaterThanOrEqual(1)
  expect(zoom).toBeLessThan(2)
  const view = zoomed(crop, photo, zoom / 2)
  expect(view.width).toBeLessThanOrEqual(photo.width)
  expect(view.width * aspect).toBeLessThanOrEqual(photo.height)
})
