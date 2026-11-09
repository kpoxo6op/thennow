import { expect, test } from "@playwright/test"

import { fits } from "@/lib/rephoto/crop"
import { MAX_ZOOM, zoomed, zoomFor } from "@/lib/rephoto/zoom"

const photo = { width: 4000, height: 3000 }
const aspect = 0.75
const range = { min: 1, max: 30 }

test.describe("the camera's own zoom", () => {
  test("a small old view in the middle is zoomed in to, never past the optical limit", () => {
    const crop = { cx: 2000, cy: 1500, width: 800, rotation: 0 }
    expect(zoomFor(crop, aspect, photo, 1, range)).toBe(MAX_ZOOM)
  })

  test("the zoom leaves room around the old view", () => {
    const crop = { cx: 2000, cy: 1500, width: 2600, rotation: 0.05 }
    const zoom = zoomFor(crop, aspect, photo, 1, range)
    expect(zoom).not.toBeNull()
    expect(zoom!).toBeGreaterThan(1)
    expect(zoom!).toBeLessThan(MAX_ZOOM)
    const view = zoomed(crop, photo, zoom!)
    expect(fits({ ...view, width: view.width * 1.1 }, aspect, photo)).toBe(true)
  })

  test("an old view off to one side is zoomed less, so it stays in the picture", () => {
    const middle = zoomFor(
      { cx: 2000, cy: 1500, width: 2000, rotation: 0 },
      aspect,
      photo,
      1,
      range
    )
    const side = zoomFor(
      { cx: 2900, cy: 1500, width: 2000, rotation: 0 },
      aspect,
      photo,
      1,
      range
    )
    expect(side ?? 1).toBeLessThan(middle!)
  })

  test("an old view spilling out of the picture zooms back out", () => {
    const crop = { cx: 2000, cy: 1500, width: 4100, rotation: 0 }
    const zoom = zoomFor(crop, aspect, photo, 2, range)
    expect(zoom!).toBeLessThan(2)
    const view = zoomed(crop, photo, zoom! / 2)
    expect(fits(view, aspect, photo)).toBe(true)
  })

  test("a view that already fills the picture leaves the zoom alone", () => {
    const crop = { cx: 2000, cy: 1500, width: 3500, rotation: 0 }
    expect(zoomFor(crop, aspect, photo, 1, range)).toBeNull()
  })

  test("a camera that can't zoom is left alone", () => {
    const crop = { cx: 2000, cy: 1500, width: 800, rotation: 0 }
    expect(zoomFor(crop, aspect, photo, 1, { min: 1, max: 1 })).toBeNull()
  })
})
