// The only edit a rephotograph gets: a rectangle laid over the real shot, turned and sized to
// frame the archive view. Rendering it rotates and scales the pixels uniformly and crops; nothing
// is stretched, warped or generated. Where the rectangle reaches past the shot, it stays black.

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

function corners(crop: Crop, aspect: number) {
  const cos = Math.cos(crop.rotation)
  const sin = Math.sin(crop.rotation)
  const hw = crop.width / 2
  const hh = (crop.width * aspect) / 2

  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) => ({
    x: crop.cx + cos * x - sin * y,
    y: crop.cy + sin * x + cos * y,
  }))
}

export function fits(crop: Crop, aspect: number, photo: Size) {
  const slack = 0.5
  return (
    crop.width > 16 &&
    corners(crop, aspect).every(
      ({ x, y }) =>
        x >= -slack &&
        y >= -slack &&
        x <= photo.width + slack &&
        y <= photo.height + slack
    )
  )
}

// The biggest unturned rectangle of the archive's shape that fits in the photograph, centred.
function centredCrop(aspect: number, photo: Size): Crop {
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

const MAX_OUTPUT_WIDTH = 4096

// Hands a canvas's memory back straight away; iPhone otherwise holds it until much later.
export function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

function outputSize(crop: Crop, aspect: number): Size {
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
  context.fillStyle = "#000"
  context.fillRect(0, 0, size.width, size.height)
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
