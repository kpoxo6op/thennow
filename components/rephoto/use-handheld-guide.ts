"use client"

import { useEffect, useRef, useState, type RefObject } from "react"

import { align, prepareArchive } from "@/lib/rephoto/align"
import { fits, releaseCanvas, type Crop, type Size } from "@/lib/rephoto/crop"
import { assessHandheld } from "@/lib/rephoto/handheld"
import { canMatchLocally, localMatcherReady } from "@/lib/rephoto/local-matcher"
import { loadImage } from "@/lib/rephoto/pixels"
import type { ReferenceLines } from "@/lib/rephoto/reference-lines"
import { diagnostic } from "@/lib/rephoto/telemetry"

type Assessment = ReturnType<typeof assessHandheld>
type Seed = { crop: Crop; size: Size; at: number }
type View = {
  state: "searching" | "conflict" | "adjusted" | "unavailable"
  crop: Crop | null
  supportedIndices: number[]
  worstFeatureIndex: number | null
}
const empty: View = {
  state: "searching",
  crop: null,
  supportedIndices: [],
  worstFeatureIndex: null,
}
const LIFE = 2500

function pixels(source: CanvasImageSource, size: Size) {
  const canvas = document.createElement("canvas")
  canvas.width = Math.min(640, size.width)
  canvas.height = Math.round((size.height * canvas.width) / size.width)
  const context = canvas.getContext("2d", { willReadFrequently: true })!
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  const data = context.getImageData(0, 0, canvas.width, canvas.height)
  return { canvas, data }
}
function resizeCrop(crop: Crop, from: Size, to: Size): Crop {
  return {
    cx: (crop.cx * to.width) / from.width,
    cy: (crop.cy * to.height) / from.height,
    width: (crop.width * to.width) / from.width,
    rotation: crop.rotation,
  }
}
function sharpness(data: ImageData) {
  let sum = 0
  for (let y = 2; y < data.height - 2; y += 2) {
    for (let x = 2; x < data.width - 2; x += 2) {
      const i = (y * data.width + x) * 4
      sum += Math.abs(
        4 * data.data[i] -
          data.data[i - 4] -
          data.data[i + 4] -
          data.data[i - data.width * 4] -
          data.data[i + data.width * 4]
      )
    }
  }
  return sum / (data.width * data.height)
}

// Identity acquisition is separate from edge refinement: straight lines in an
// unrelated scene must never be enough to crop the photograph automatically.
export function useHandheldGuide({
  guide,
  thenSrc,
  video,
  active,
}: {
  guide: ReferenceLines | null
  thenSrc: string
  video: RefObject<HTMLVideoElement | null>
  active: boolean
}) {
  const [view, setView] = useState<View>(empty)
  const lifecycle = active ? thenSrc : ""
  const [viewLifecycle, setViewLifecycle] = useState(lifecycle)
  if (viewLifecycle !== lifecycle) {
    setViewLifecycle(lifecycle)
    setView(empty)
  }
  const seed = useRef<Seed | null>(null)
  const archive = useRef<ImageData | null>(null)
  const taking = useRef(false)
  const generation = useRef(0)
  const revision = useRef(0)
  useEffect(() => {
    const epoch = ++generation.current
    seed.current = null
    archive.current = null
    if (!guide || !active) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    let expiry: ReturnType<typeof setTimeout>
    let lastState = ""
    let lastLog = 0
    const valid = () =>
      !controller.signal.aborted && generation.current === epoch
    const clear = () => {
      revision.current++
      seed.current = null
      setView(empty)
      clearTimeout(expiry)
    }
    const visibility = () => {
      if (document.visibilityState !== "visible") clear()
    }
    document.addEventListener("visibilitychange", visibility)
    const element = video.current
    element?.addEventListener("resize", clear)
    void loadImage(thenSrc)
      .then((image) => {
        if (!valid()) return
        const prepared = prepareArchive(image)
        const original = pixels(image, {
          width: image.naturalWidth,
          height: image.naturalHeight,
        })
        archive.current = original.data
        releaseCanvas(original.canvas)
        const loop = async () => {
          const started = performance.now()
          const viewRevision = revision.current
          const live = video.current
          let frame: ReturnType<typeof pixels> | null = null
          try {
            if (
              !valid() ||
              taking.current ||
              document.visibilityState !== "visible" ||
              !live?.videoWidth ||
              live.readyState < 2
            )
              return
            const size = { width: live.videoWidth, height: live.videoHeight }
            if (!canMatchLocally()) {
              setView({ ...empty, state: "unavailable" })
              return
            }
            if (!localMatcherReady()) {
              setView(empty)
              return
            }
            frame = pixels(live, size)
            let identity = seed.current
            if (
              !identity ||
              started - identity.at > LIFE ||
              identity.size.width !== size.width ||
              identity.size.height !== size.height
            ) {
              const found = await align(
                prepared,
                frame.canvas,
                frame.data,
                controller.signal,
                { server: false }
              )
              if (
                !valid() ||
                taking.current ||
                revision.current !== viewRevision ||
                document.visibilityState !== "visible" ||
                live.videoWidth !== size.width ||
                live.videoHeight !== size.height
              )
                return
              if (!found) {
                clear()
                return
              }
              identity = {
                crop: resizeCrop(found.crop, frame.data, size),
                size,
                at: performance.now(),
              }
              // Inference may have been slow. Always refine a new frame before displaying anything.
              releaseCanvas(frame.canvas)
              frame = pixels(live, size)
            }
            let result = assessHandheld(
              archive.current!,
              frame.data,
              guide,
              resizeCrop(identity.crop, size, frame.data)
            )
            // A global coarse fit may prefer one face. Inspect the user's fixed
            // target as well, but only after independently recognising the place.
            if (result.state === "searching") {
              const target = assessHandheld(
                archive.current!,
                frame.data,
                guide,
                {
                  cx: frame.data.width / 2,
                  cy: frame.data.height / 2,
                  width:
                    Math.min(
                      frame.data.width,
                      frame.data.height / prepared.aspect
                    ) * 0.9,
                  rotation: 0,
                }
              )
              if (target.state !== "searching") result = target
            }
            if (!valid() || taking.current) return
            const correction =
              result.state === "adjusted" && result.crop
                ? resizeCrop(result.crop, frame.data, size)
                : null
            const safe =
              correction &&
              fits(correction, prepared.aspect, size) &&
              correction.width >= size.width * 0.55 &&
              Math.abs(correction.rotation) <= Math.PI / 12
            seed.current = {
              ...identity,
              crop: safe ? correction : identity.crop,
            }
            setView({
              state:
                result.state === "adjusted" && !safe
                  ? "searching"
                  : result.state,
              crop: safe ? correction : null,
              supportedIndices: result.supportedIndices,
              worstFeatureIndex: result.worstFeatureIndex,
            })
            clearTimeout(expiry)
            // Do not leave a correction or instruction on screen during a stalled matcher.
            expiry = setTimeout(() => {
              if (valid() && !taking.current) setView(empty)
            }, 800)
            if (result.state !== lastState || started - lastLog > 5000) {
              diagnostic("assistance", {
                state: result.state,
                supported: result.supportedIndices.length,
                regions: result.regions.length,
                residual: result.regions.some(
                  (region) => region.residual !== null
                )
                  ? Math.max(
                      ...result.regions.flatMap((region) =>
                        region.residual === null ? [] : [region.residual]
                      )
                    )
                  : null,
                frameAge: performance.now() - started,
                ms: performance.now() - started,
              })
              lastState = result.state
              lastLog = started
            }
          } catch {
            if (valid()) clear()
          } finally {
            if (frame) releaseCanvas(frame.canvas)
            if (valid())
              timer = setTimeout(
                () => void loop(),
                Math.max(180, 350 - (performance.now() - started))
              )
          }
        }
        void loop()
      })
      .catch(() => {
        if (valid()) setView({ ...empty, state: "unavailable" })
      })
    return () => {
      generation.current = epoch + 1
      controller.abort()
      clearTimeout(timer)
      clearTimeout(expiry)
      seed.current = null
      document.removeEventListener("visibilitychange", visibility)
      element?.removeEventListener("resize", clear)
    }
  }, [guide, thenSrc, active, video])

  const capture = async (fallback: Crop, aspect: number) => {
    const live = video.current
    if (!live?.videoWidth) return null
    taking.current = true
    const epoch = generation.current
    const captureRevision = revision.current
    const started = performance.now()
    const identity = seed.current
    let best: {
      canvas: HTMLCanvasElement
      crop: Crop
      score: number
      assessment: Assessment | null
      selected: number
      mediaTime: number
    } | null = null
    let count = 0
    let pending: HTMLCanvasElement | null = null
    let smallFrame: HTMLCanvasElement | null = null
    try {
      for (let i = 0; i < 3; i++) {
        if (i) await new Promise((resolve) => setTimeout(resolve, 120))
        if (
          epoch !== generation.current ||
          captureRevision !== revision.current ||
          document.visibilityState !== "visible" ||
          live.readyState < 2
        )
          break
        const canvas = document.createElement("canvas")
        pending = canvas
        canvas.width = live.videoWidth
        canvas.height = live.videoHeight
        canvas.getContext("2d")!.drawImage(live, 0, 0)
        const small = pixels(canvas, canvas)
        smallFrame = small.canvas
        let assessment: Assessment | null = null
        if (
          guide &&
          archive.current &&
          identity &&
          started - identity.at <= LIFE &&
          identity.size.width === canvas.width &&
          identity.size.height === canvas.height
        ) {
          assessment = assessHandheld(
            archive.current,
            small.data,
            guide,
            resizeCrop(identity.crop, identity.size, small.data)
          )
        }
        const refined =
          assessment?.state === "adjusted" && assessment.crop
            ? resizeCrop(assessment.crop, small.data, canvas)
            : null
        const validCrop =
          refined &&
          fits(refined, aspect, canvas) &&
          refined.width >= canvas.width * 0.55 &&
          Math.abs(refined.rotation) <= Math.PI / 12
        if (!validCrop) assessment = null
        const score = sharpness(small.data)
        releaseCanvas(small.canvas)
        smallFrame = null
        count++
        // Never rank unknown geometry by sharpness. A later frame must independently
        // support all regions and cannot worsen any region of the pressed frame.
        const noWorse =
          assessment &&
          (!best?.assessment ||
            assessment.regions.every((region, index) => {
              const previous = best!.assessment!.regions[index]?.residual
              return (
                region.residual !== null &&
                previous != null &&
                region.residual <= previous
              )
            }))
        if (!best || (noWorse && (!best.assessment || score > best.score))) {
          if (best) releaseCanvas(best.canvas)
          best = {
            canvas,
            crop: validCrop ? refined : fallback,
            assessment,
            score,
            selected: i,
            mediaTime: live.currentTime * 1000,
          }
        } else releaseCanvas(canvas)
        pending = null
        // Without a fresh identity, preserve the pressed frame immediately.
        if (!identity || started - identity.at > LIFE) break
      }
      if (
        epoch !== generation.current ||
        captureRevision !== revision.current ||
        document.visibilityState !== "visible"
      ) {
        if (best) releaseCanvas(best.canvas)
        return null
      }
      const burst = {
        frames: count,
        selected: best?.selected ?? 0,
        assisted: !!best?.assessment,
        ms: performance.now() - started,
      }
      return (
        best && {
          canvas: best.canvas,
          crop: best.crop,
          assisted: !!best.assessment,
          mediaTime: best.mediaTime,
          burst,
        }
      )
    } catch (error) {
      if (pending) releaseCanvas(pending)
      if (smallFrame) releaseCanvas(smallFrame)
      if (best) releaseCanvas(best.canvas)
      throw error
    } finally {
      taking.current = false
    }
  }
  return { ...view, capture }
}
