// The only edit a rephotograph gets: a rectangle laid over the real shot, turned and sized to
// frame the archive view. Rendering it rotates and scales the pixels uniformly and crops; nothing
// is stretched, warped, filled in or generated, and the rectangle may never leave the photograph.

export type Crop = {
  // Centre of the rectangle, in photograph pixels.
  cx: number
  cy: number
  // Width of the rectangle in photograph pixels; its height follows from the archive's aspect.
  width: number
  // Radians the rectangle is turned, clockwise on screen.
  rotation: number
}

export type Size = { width: number; height: number }

export function corners(crop: Crop, aspect: number) {
  const cos = Math.cos(crop.rotation)
  const sin = Math.sin(crop.rotation)
  const hw = crop.width / 2
  const hh = (crop.width * aspect) / 2

  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) => ({ x: crop.cx + cos * x - sin * y, y: crop.cy + sin * x + cos * y }))
}

export function fits(crop: Crop, aspect: number, photo: Size) {
  const slack = 0.5
  return (
    crop.width > 16 &&
    corners(crop, aspect).every(
      ({ x, y }) => x >= -slack && y >= -slack && x <= photo.width + slack && y <= photo.height + slack
    )
  )
}

// Moves from a crop that fits towards a wanted one and stops at the photograph's edge,
// so a gesture slides along the border instead of freezing.
export function clampCrop(from: Crop, to: Crop, aspect: number, photo: Size): Crop {
  if (![to.cx, to.cy, to.width, to.rotation].every(Number.isFinite)) {
    return from
  }
  if (fits(to, aspect, photo)) {
    return to
  }

  // Keep what fits of each change on its own, so a pinch at the edge still turns or pans.
  let current = from
  const parts: Array<(c: Crop) => Crop> = [
    (c) => ({ ...c, width: to.width }),
    (c) => ({ ...c, rotation: to.rotation }),
    (c) => ({ ...c, cx: to.cx }),
    (c) => ({ ...c, cy: to.cy }),
  ]
  for (const apply of parts) {
    const target = apply(current)
    if (fits(target, aspect, photo)) {
      current = target
      continue
    }
    let lo = 0
    let hi = 1
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2
      const trial = mix(current, target, mid)
      if (fits(trial, aspect, photo)) lo = mid
      else hi = mid
    }
    current = mix(current, target, lo)
  }

  return current
}

function mix(a: Crop, b: Crop, t: number): Crop {
  return {
    cx: a.cx + (b.cx - a.cx) * t,
    cy: a.cy + (b.cy - a.cy) * t,
    width: a.width + (b.width - a.width) * t,
    rotation: a.rotation + (b.rotation - a.rotation) * t,
  }
}

// The biggest unturned rectangle of the archive's shape that fits in the photograph, centred.
export function centredCrop(aspect: number, photo: Size): Crop {
  const width = Math.min(photo.width, photo.height / aspect)
  return { cx: photo.width / 2, cy: photo.height / 2, width, rotation: 0 }
}

// Shrinks a crop about its centre until it fits, for a framing that started slightly outside.
export function shrinkToFit(crop: Crop, aspect: number, photo: Size): Crop {
  let next = crop
  for (let i = 0; i < 60 && !fits(next, aspect, photo); i++) {
    next = { ...next, width: next.width * 0.97 }
  }
  if (!fits(next, aspect, photo)) {
    return centredCrop(aspect, photo)
  }
  return next
}

export const MAX_OUTPUT_WIDTH = 4096

// Hands a canvas's memory back straight away; iPhone otherwise holds it until much later.
export function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

export function outputSize(crop: Crop, aspect: number): Size {
  const width = Math.round(Math.min(MAX_OUTPUT_WIDTH, crop.width))
  return { width, height: Math.round(width * aspect) }
}

// Draws the crop into a canvas: one uniform scale and one rotation of the real photograph.
export function renderCrop(
  photo: CanvasImageSource,
  crop: Crop,
  aspect: number,
  canvas: HTMLCanvasElement
) {
  const size = outputSize(crop, aspect)
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("No 2D canvas")
  }
  const k = size.width / crop.width
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.translate(size.width / 2, size.height / 2)
  context.scale(k, k)
  context.rotate(-crop.rotation)
  context.translate(-crop.cx, -crop.cy)
  context.drawImage(photo, 0, 0)

  return size
}
