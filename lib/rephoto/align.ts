import type { Size } from "@/lib/rephoto/crop"
import {
  canMatchLocally,
  localMatcherReady,
  localMatcherWarm,
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
  type FitDiagnostic,
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

// The middle of the picture a view is looked for in when it can't be found in the whole.
export const NEAR_REACH = 0.65

// The part of the picture a landscape archive view is looked for in, in its pixels: centred, the
// model's own shape, and `reach` of the picture's width. Fitted whole, an upright picture would
// reach the model at half the detail; a narrower reach looks closer, for a view far away.
export type Region = { x: number; y: number; width: number; height: number }
export function region(photo: Size, aspect: number, reach = 1): Region | null {
  if (aspect >= 1 || (reach >= 1 && photo.height <= photo.width)) return null
  const width = Math.round(photo.width * Math.min(1, reach))
  const height = Math.min(
    photo.height,
    Math.round((width * MATCH_HEIGHT) / MATCH_WIDTH)
  )
  return {
    x: Math.round((photo.width - width) / 2),
    y: Math.round((photo.height - height) / 2),
    width,
    height,
  }
}

// That part of the picture, drawn at about twice the model's size so it still scales down well.
function cut(source: CanvasImageSource, part: Region) {
  const canvas = document.createElement("canvas")
  canvas.width = Math.min(part.width, MATCH_WIDTH * 2)
  canvas.height = Math.round((part.height * canvas.width) / part.width)
  const context = canvas.getContext("2d")
  if (!context) throw new Error("No 2D canvas")
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.drawImage(
    source,
    part.x,
    part.y,
    part.width,
    part.height,
    0,
    0,
    canvas.width,
    canvas.height
  )
  return canvas
}

// Where the time of the last match went, for the camera's report: getting the picture ready,
// and the model itself.
const SERVER_MS = 25_000

export const timing = { prepareMs: 0, modelMs: 0 }

// Finds the archive view in a picture: on the phone's graphics chip when it can, otherwise, if
// allowed, on the server. Null when the two can't be matched.
export type AlignDiagnostic = {
  reason:
    | FitDiagnostic["reason"]
    | "aborted"
    | "local_timeout"
    | "local_inference_error"
    | "model_unavailable"
    | "server_timeout"
    | "server_error"
    | "prepare_error"
  backend: "none" | "local" | "server"
  prepareMs: number
  modelMs: number
  matches?: number
  inliers?: number
  fallbackReason?:
    | "local_timeout"
    | "local_inference_error"
    | "model_unavailable"
}

export async function align(
  archive: Archive,
  source: CanvasImageSource,
  photo: Size,
  signal: AbortSignal,
  {
    server,
    reach = 1,
    diagnostic,
    minCoverage,
  }: {
    server: boolean
    reach?: number
    minCoverage?: number
    diagnostic?: (details: AlignDiagnostic) => void
  }
): Promise<Fit | null> {
  const begun = performance.now()
  let modelBegun = 0
  let backend: AlignDiagnostic["backend"] = "none"
  let prepareMs = 0
  let fallbackReason: AlignDiagnostic["fallbackReason"]
  let outcome: AlignDiagnostic["reason"] = "prepare_error"
  const report = (reason: AlignDiagnostic["reason"], fit?: FitDiagnostic) => {
    const details: AlignDiagnostic = {
      ...fit,
      reason,
      backend,
      prepareMs,
      modelMs: modelBegun ? performance.now() - modelBegun : 0,
      ...(fallbackReason ? { fallbackReason } : {}),
    }
    timing.prepareMs = details.prepareMs
    timing.modelMs = details.modelMs
    try {
      diagnostic?.(details)
    } catch {}
  }
  try {
    const part = region(photo, archive.aspect, reach)
    const picture = part ? cut(source, part) : null
    let frame: ReturnType<typeof matchPixels>
    try {
      frame = picture
        ? matchPixels(picture, picture.width, picture.height)
        : matchPixels(source, photo.width, photo.height)
    } finally {
      if (picture) {
        picture.width = 0
        picture.height = 0
      }
    }
    prepareMs = performance.now() - begun
    modelBegun = performance.now()
    let raw = null
    fallbackReason = "model_unavailable"
    if (canMatchLocally()) {
      backend = "local"
      const local = within(
        signal,
        localMatcherWarm() ? 8_000 : localMatcherReady() ? 20_000 : 3_000
      )
      try {
        raw = await matchLocally(archive.gray, frame.gray, local.signal)
        fallbackReason = undefined
      } catch {
        fallbackReason =
          local.signal.aborted && !signal.aborted
            ? "local_timeout"
            : canMatchLocally()
              ? "local_inference_error"
              : "model_unavailable"
      } finally {
        local.done()
      }
    }
    signal.throwIfAborted()
    if (!raw) {
      if (!server) {
        report(fallbackReason ?? "model_unavailable")
        return null
      }
      backend = "server"
      outcome = "server_error"
      const remote = within(signal, SERVER_MS)
      try {
        raw = await requestMatches(archive.gray, frame.gray, remote.signal)
      } catch (error) {
        if (remote.signal.aborted && !signal.aborted) outcome = "server_timeout"
        throw error
      } finally {
        remote.done()
      }
    }
    signal.throwIfAborted()
    const matches = unplace(raw, archive.placement, frame.placement).map(
      ([u0, v0, u1, v1]): (typeof raw)[number] =>
        part
          ? [
              u0,
              v0,
              (part.x + u1 * part.width) / photo.width,
              (part.y + v1 * part.height) / photo.height,
            ]
          : [u0, v0, u1, v1]
    )
    return fitCrop(
      matches,
      archive.aspect,
      photo,
      cellSize(part ?? photo, frame.placement),
      (fit) => report(fit.reason, fit),
      minCoverage
    )
  } catch (error) {
    if (!modelBegun) prepareMs = performance.now() - begun
    report(signal.aborted ? "aborted" : outcome)
    throw error
  }
}
