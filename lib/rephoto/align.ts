import type { Size } from "@/lib/rephoto/crop"
import {
  canMatchLocally,
  localMatcherReady,
  matchLocally,
} from "@/lib/rephoto/local-matcher"
import {
  cellSize,
  fitCrop,
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

// Finds the archive view in a picture: on the phone's graphics chip when it can, otherwise, if
// allowed, on the server. Null when the two can't be matched.
export async function align(
  archive: Archive,
  source: CanvasImageSource,
  photo: Size,
  signal: AbortSignal,
  { server }: { server: boolean }
): Promise<Fit | null> {
  const frame = matchPixels(source, photo.width, photo.height)
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
  const matches = unplace(raw, archive.placement, frame.placement)
  return fitCrop(
    matches,
    archive.aspect,
    photo,
    cellSize(photo, frame.placement)
  )
}
