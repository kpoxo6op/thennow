import { fits, type Crop, type Size } from "@/lib/rephoto/crop"

// The camera zooms itself so the old view fills the picture, never further than this. Past about
// 2x a phone's main sensor runs out of real detail, and a page can't tell its telephoto lens
// from digital zoom, so a further zoom could quietly blur the shot.
export const MAX_ZOOM = 2

// The old view is kept this much smaller than the picture, for room to turn and sway.
const MARGIN = 1.12

// Changes smaller than this aren't worth the matcher losing its place.
const STEP = 1.12

export type ZoomRange = { min: number; max: number }

// What the crop becomes when the camera zooms by `factor` about the picture's centre.
export function zoomed(crop: Crop, photo: Size, factor: number): Crop {
  return {
    cx: photo.width / 2 + (crop.cx - photo.width / 2) * factor,
    cy: photo.height / 2 + (crop.cy - photo.height / 2) * factor,
    width: crop.width * factor,
    rotation: crop.rotation,
  }
}

// The zoom at which the old view, found at `crop` in a picture taken at zoom `current`, is as big
// as it can be while staying wholly inside with a margin; null when the camera should stay put.
export function zoomFor(
  crop: Crop,
  aspect: number,
  photo: Size,
  current: number,
  range: ZoomRange
): number | null {
  const lowest = Math.max(range.min, 1)
  const highest = Math.min(range.max, MAX_ZOOM)
  if (highest <= lowest) return null
  const room = (zoom: number) => {
    const view = zoomed(crop, photo, zoom / current)
    return fits({ ...view, width: view.width * MARGIN }, aspect, photo)
  }
  let target: number
  if (!room(lowest)) {
    target = lowest
  } else {
    let low = lowest
    let high = highest
    if (room(high)) low = high
    for (let i = 0; i < 24 && high - low > 0.01; i++) {
      const middle = (low + high) / 2
      if (room(middle)) low = middle
      else high = middle
    }
    target = low
  }
  target = Math.max(lowest, Math.floor(target * 10) / 10)
  if (target === current) return null
  // An old view running off the picture is always zoomed out to; otherwise small changes wait.
  if (!fits(crop, aspect, photo) && target < current) return target
  const ratio = target / current
  return ratio < STEP && ratio > 1 / STEP ? null : target
}
