"use client"

import { useEffect, useRef, useState, type RefObject } from "react"

import { align, prepareArchive } from "@/lib/rephoto/align"
import { fits, releaseCanvas, type Crop, type Size } from "@/lib/rephoto/crop"
import type { HandheldAssessment } from "@/lib/rephoto/handheld"
import { HandheldEvaluator } from "@/lib/rephoto/handheld-client"
import { canMatchLocally, localMatcherReady } from "@/lib/rephoto/local-matcher"
import { loadImage } from "@/lib/rephoto/pixels"
import type { ReferenceLines } from "@/lib/rephoto/reference-lines"
import { diagnostic } from "@/lib/rephoto/telemetry"

type Assessment = HandheldAssessment
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
function fixedTarget(size: Size, aspect: number): Crop {
  return {
    cx: size.width / 2,
    cy: size.height / 2,
    width: Math.min(size.width, size.height / aspect) * 0.9,
    rotation: 0,
  }
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
  const evaluator = useRef<HandheldEvaluator | null>(null)
  const taking = useRef(false)
  const generation = useRef(0)
  const revision = useRef(0)
  useEffect(() => {
    const epoch = ++generation.current
    seed.current = null
    evaluator.current = null
    if (!guide || !active) return
    const controller = new AbortController()
    let worker: HandheldEvaluator
    try {
      worker = new HandheldEvaluator()
    } catch {
      void Promise.resolve().then(() => {
        if (generation.current === epoch)
          setView({ ...empty, state: "unavailable" })
      })
      return () => {
        generation.current = epoch + 1
      }
    }
    evaluator.current = worker
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
      .then(async (image) => {
        if (!valid()) return
        const prepared = prepareArchive(image)
        const original = pixels(image, {
          width: image.naturalWidth,
          height: image.naturalHeight,
        })
        const ready = await worker.prepare(original.data, guide)
        releaseCanvas(original.canvas)
        if (!valid()) return
        if (!ready) {
          setView({ ...empty, state: "unavailable" })
          return
        }
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
              live.paused ||
              live.ended ||
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
            let sampledAt = performance.now()
            frame = pixels(live, size)
            let sampleMs = performance.now() - sampledAt
            let modelMs = 0
            let identity = seed.current
            if (
              !identity ||
              started - identity.at > LIFE ||
              identity.size.width !== size.width ||
              identity.size.height !== size.height
            ) {
              const modelStarted = performance.now()
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
                live.videoHeight !== size.height ||
                live.paused ||
                live.ended
              )
                return
              modelMs = performance.now() - modelStarted
              if (!found) {
                if (
                  lastState !== "identity_not_found" ||
                  started - lastLog > 5000
                ) {
                  diagnostic("assistance", {
                    state: "searching",
                    reason: "identity_not_found",
                    frameAge: performance.now() - sampledAt,
                    ms: performance.now() - started,
                    sampleMs,
                    modelMs,
                  })
                  lastState = "identity_not_found"
                  lastLog = started
                }
                clear()
                return
              }
              identity = {
                crop: resizeCrop(found.crop, frame.data, size),
                size,
                at: sampledAt,
              }
              // Inference may have been slow. Always refine a new frame before displaying anything.
              releaseCanvas(frame.canvas)
              const sampleStarted = performance.now()
              sampledAt = sampleStarted
              frame = pixels(live, size)
              sampleMs += performance.now() - sampleStarted
            }
            if (performance.now() - identity.at > LIFE) {
              clear()
              diagnostic("assistance", {
                state: "searching",
                reason: "stale_frame",
                frameAge: performance.now() - sampledAt,
                identityAge: performance.now() - identity.at,
                ms: performance.now() - started,
                sampleMs,
                modelMs,
              })
              return
            }
            const refineStarted = performance.now()
            const reply = await worker.assess(
              frame.data,
              resizeCrop(identity.crop, size, frame.data),
              fixedTarget(frame.data, prepared.aspect),
              prepared.aspect
            )
            const refineMs = performance.now() - refineStarted
            if (
              !valid() ||
              taking.current ||
              revision.current !== viewRevision ||
              document.visibilityState !== "visible" ||
              live.videoWidth !== size.width ||
              live.videoHeight !== size.height ||
              live.paused ||
              live.ended
            )
              return
            if (
              !reply ||
              performance.now() - sampledAt >= 800 ||
              performance.now() - identity.at > LIFE
            ) {
              clear()
              diagnostic("assistance", {
                state: "searching",
                reason: reply ? "stale_frame" : "worker_failed",
                frameAge: performance.now() - sampledAt,
                identityAge: performance.now() - identity.at,
                ms: performance.now() - started,
                sampleMs,
                modelMs,
                refineMs,
              })
              if (!reply) {
                // A terminated worker cannot recover inside this camera lifecycle.
                // Stop acquisition too; retake/reopen creates a fresh evaluator.
                setView({ ...empty, state: "unavailable" })
                controller.abort()
                worker.dispose()
              }
              return
            }
            const result = reply.assessment
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
            expiry = setTimeout(
              () => {
                if (valid() && !taking.current) setView(empty)
              },
              Math.max(
                0,
                Math.min(
                  800 - (performance.now() - sampledAt),
                  LIFE - (performance.now() - identity.at)
                )
              )
            )
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
                reason: result.reason,
                sampleMs,
                modelMs,
                refineMs,
                identityAge: performance.now() - identity.at,
                frameAge: performance.now() - sampledAt,
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
      worker.dispose()
      if (evaluator.current === worker) evaluator.current = null
      clearTimeout(timer)
      clearTimeout(expiry)
      seed.current = null
      document.removeEventListener("visibilitychange", visibility)
      element?.removeEventListener("resize", clear)
    }
  }, [guide, thenSrc, active, video])

  const capture = async (fallback: Crop, aspect: number) => {
    const live = video.current
    if (!live?.videoWidth || taking.current) return null
    taking.current = true
    const epoch = generation.current
    const captureRevision = revision.current
    const started = performance.now()
    const identity = seed.current
    const worker = evaluator.current
    let best: {
      canvas: HTMLCanvasElement
      crop: Crop
      score: number
      assessment: Assessment | null
      selected: number
      mediaTime: number
      sampledAt: number
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
          live.paused ||
          live.ended ||
          live.readyState < 2
        )
          break
        const canvas = document.createElement("canvas")
        pending = canvas
        canvas.width = live.videoWidth
        canvas.height = live.videoHeight
        const sampledAt = performance.now()
        canvas.getContext("2d")!.drawImage(live, 0, 0)
        const mediaTime = live.currentTime * 1000
        const small = pixels(canvas, canvas)
        smallFrame = small.canvas
        let assessment: Assessment | null = null
        let score = 0
        if (
          guide &&
          worker &&
          identity &&
          sampledAt - identity.at <= LIFE &&
          identity.size.width === canvas.width &&
          identity.size.height === canvas.height
        ) {
          await worker.idle()
          if (
            epoch !== generation.current ||
            captureRevision !== revision.current ||
            document.visibilityState !== "visible"
          )
            break
          if (
            performance.now() - sampledAt < 800 &&
            performance.now() - identity.at <= LIFE
          ) {
            const reply = await worker.assess(
              small.data,
              resizeCrop(identity.crop, identity.size, small.data),
              fixedTarget(small.data, aspect),
              aspect
            )
            if (
              reply &&
              performance.now() - sampledAt < 800 &&
              performance.now() - identity.at <= LIFE
            ) {
              assessment = reply.assessment
              score = reply.sharpness
            }
          }
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
            mediaTime,
            sampledAt,
          }
        } else releaseCanvas(canvas)
        pending = null
        // Without a fresh identity, preserve the pressed frame immediately.
        if (!identity || performance.now() - identity.at > LIFE) break
      }
      if (pending) {
        releaseCanvas(pending)
        pending = null
      }
      if (smallFrame) {
        releaseCanvas(smallFrame)
        smallFrame = null
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
        reason: best?.assessment
          ? "assisted"
          : !identity
            ? "no_identity"
            : performance.now() - identity.at > LIFE
              ? "expired_identity"
              : "rejected_geometry",
        ms: performance.now() - started,
      }
      return (
        best && {
          canvas: best.canvas,
          crop: best.crop,
          assisted: !!best.assessment,
          mediaTime: best.mediaTime,
          frameAge: performance.now() - best.sampledAt,
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
