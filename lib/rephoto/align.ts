import type { Size } from "@/lib/rephoto/crop"
import {
  canMatchLocally,
  localMatcherReady,
  matchLocally,
} from "@/lib/rephoto/local-matcher"
import {
  cellSize,
  fitCrop,
  MATCH_HEIGHT,
  MATCH_WIDTH,
  matchPixels,
  requestMatches,
  unplace,
  type Fit,
} from "@/lib/rephoto/match"

export type Archive = ReturnType<typeof matchPixels> & { aspect: number }

export function prepareArchive(image: HTMLImageElement): Archive {
  return {
    ...matchPixels(image, image.naturalWidth, image.naturalHeight),
    aspect: image.naturalHeight / image.naturalWidth,
  }
}

// A signal that aborts with its parent or after ms, whichever comes first. (AbortSignal.any and
// AbortSignal.timeout are missing from Safari before 17.4.)
function within(parent: AbortSignal, ms: number) {
  const controller = new AbortController()
  const stop = () => controller.abort()
  if (parent.aborted) stop()
  parent.addEventListener("abort", stop, { once: true })
  const timer = setTimeout(stop, ms)
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer)
      parent.removeEventListener("abort", stop)
    },
  }
}

// The part of an upright picture a landscape archive view is looked for in: a band across the
// middle, as wide as the picture and as tall as the model's own shape. Fitted whole, an upright
// picture would reach the model at half the detail and a distant view would be lost in it.
export function band(photo: Size, aspect: number) {
  if (photo.height <= photo.width || aspect >= 1) return null
  const height = Math.min(
    photo.height,
    Math.round((photo.width * MATCH_HEIGHT) / MATCH_WIDTH)
  )
  return { y: Math.round((photo.height - height) / 2), height }
}

// The band of the picture, drawn at about twice the model's size so it still scales down well.
function cut(
  source: CanvasImageSource,
  photo: Size,
  part: { y: number; height: number }
) {
  const canvas = document.createElement("canvas")
  canvas.width = Math.min(photo.width, MATCH_WIDTH * 2)
  canvas.height = Math.round((part.height * canvas.width) / photo.width)
  const context = canvas.getContext("2d")
  if (!context) throw new Error("No 2D canvas")
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.drawImage(
    source,
    0,
    part.y,
    photo.width,
    part.height,
    0,
    0,
    canvas.width,
    canvas.height
  )
  return canvas
}

// Finds the archive view in a picture: on the phone's graphics chip when it can, otherwise, if
// allowed, on the server. Null when the two can't be matched.
export async function align(
  archive: Archive,
  source: CanvasImageSource,
  photo: Size,
  signal: AbortSignal,
  { server }: { server: boolean }
): Promise<Fit | null> {
  const part = band(photo, archive.aspect)
  const picture = part ? cut(source, photo, part) : null
  const frame = picture
    ? matchPixels(picture, picture.width, picture.height)
    : matchPixels(source, photo.width, photo.height)
  if (picture) {
    picture.width = 0
    picture.height = 0
  }
  let raw = null
  if (canMatchLocally()) {
    // A warmed-up matcher answers in about a second; one still loading gets a short grace.
    const local = within(signal, localMatcherReady() ? 8_000 : 3_000)
    raw = await matchLocally(archive.gray, frame.gray, local.signal).catch(
      () => null
    )
    local.done()
  }
  signal.throwIfAborted()
  if (!raw) {
    if (!server) return null
    const remote = within(signal, 10_000)
    try {
      raw = await requestMatches(archive.gray, frame.gray, remote.signal)
    } finally {
      remote.done()
    }
  }
  signal.throwIfAborted()
  const matches = unplace(raw, archive.placement, frame.placement).map(
    ([u0, v0, u1, v1]): (typeof raw)[number] =>
      part
        ? [u0, v0, u1, (part.y + v1 * part.height) / photo.height]
        : [u0, v0, u1, v1]
  )
  return fitCrop(
    matches,
    archive.aspect,
    photo,
    cellSize(photo, frame.placement)
  )
}
