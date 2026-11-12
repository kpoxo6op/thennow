"use client"

import { useEffect, useRef, useState, type RefObject } from "react"

import { releaseCanvas, renderCrop } from "@/lib/rephoto/crop"
import {
  CAMERA_ACTIONS,
  type CameraDecisionAction,
  type DecisionResult,
} from "@/lib/rephoto/decision"
import { diagnostic } from "@/lib/rephoto/telemetry"

const quiet = {
  action: "unknown" as CameraDecisionAction,
  loading: false,
  unavailable: false,
}

// Bounded experimental coaching. Responses never affect capture, crop or lock.
export function useDecisionGuide({
  video,
  slug,
  aspect,
  active,
}: {
  video: RefObject<HTMLVideoElement | null>
  slug: string
  aspect: number
  active: boolean
}) {
  const [view, setView] = useState(quiet)
  const scope = active ? `${slug}:${aspect}` : ""
  const [viewScope, setViewScope] = useState(scope)
  if (viewScope !== scope) {
    setViewScope(scope)
    setView(quiet)
  }
  const budget = useRef(0)
  useEffect(() => {
    if (!active) return
    let stopped = false
    let revision = 0
    let timer: ReturnType<typeof setTimeout>
    let expiry: ReturnType<typeof setTimeout>
    let request: AbortController | null = null
    let motionTimer: ReturnType<typeof setInterval>
    const probe = document.createElement("canvas")
    probe.width = probe.height = 32
    const probeContext = probe.getContext("2d", { willReadFrequently: true })!
    const signature = (element: HTMLVideoElement) => {
      const w = Math.min(element.videoWidth, element.videoHeight / aspect) * 0.9
      probeContext.drawImage(
        element,
        (element.videoWidth - w) / 2,
        (element.videoHeight - w * aspect) / 2,
        w,
        w * aspect,
        0,
        0,
        32,
        32
      )
      return probeContext.getImageData(0, 0, 32, 32).data
    }
    const moved = (before: Uint8ClampedArray, after: Uint8ClampedArray) => {
      let difference = 0
      for (let i = 0; i < before.length; i += 4)
        difference +=
          Math.abs(before[i] - after[i]) +
          Math.abs(before[i + 1] - after[i + 1]) +
          Math.abs(before[i + 2] - after[i + 2])
      return difference / (32 * 32 * 3 * 255) > 0.08
    }
    let previous: { jpeg: string; at: number } | undefined
    let candidate: CameraDecisionAction = "unknown"
    const live = video.current
    const clear = () => {
      revision++
      request?.abort()
      previous = undefined
      candidate = "unknown"
      clearTimeout(expiry)
      clearInterval(motionTimer)
      setView(quiet)
    }
    const visible = () => {
      if (document.visibilityState !== "visible") clear()
    }
    document.addEventListener("visibilitychange", visible)
    live?.addEventListener("resize", clear)
    const loop = async () => {
      const epoch = revision
      if (stopped || budget.current >= 40) return
      const element = video.current
      if (
        document.visibilityState !== "visible" ||
        !element?.videoWidth ||
        element.readyState < 2 ||
        element.paused ||
        element.ended
      ) {
        timer = setTimeout(() => void loop(), 500)
        return
      }
      const started = performance.now()
      const width = element.videoWidth,
        height = element.videoHeight
      const observed = signature(element)
      const canvas = document.createElement("canvas")
      try {
        // Same fixed 90% composition as the visible reference; no guide pixels.
        renderCrop(
          element,
          {
            cx: width / 2,
            cy: height / 2,
            width: Math.min(width, height / aspect) * 0.9,
            rotation: 0,
          },
          aspect,
          canvas,
          Math.min(640, 640 / aspect)
        )
        const current = {
          jpeg: canvas.toDataURL("image/jpeg", 0.65),
          at: started,
        }
        releaseCanvas(canvas)
        if (current.jpeg.length > 270000) return
        request = new AbortController()
        const timeout = setTimeout(() => request?.abort(), 2800)
        budget.current++
        setView((state) => ({ ...state, loading: state.action === "unknown" }))
        let response: Response
        let result: DecisionResult
        try {
          response = await fetch("/api/camera-decision", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              slug,
              current,
              previous:
                previous && started - previous.at < 30000
                  ? previous
                  : undefined,
            }),
            signal: request.signal,
          })
          result = (await response.json()) as DecisionResult
        } finally {
          clearTimeout(timeout)
        }
        if (
          stopped ||
          epoch !== revision ||
          document.visibilityState !== "visible" ||
          element.paused ||
          element.ended ||
          element.videoWidth !== width ||
          element.videoHeight !== height
        )
          return
        const age = performance.now() - started
        const fresh = age < 1800 && !moved(observed, signature(element))
        const action =
          response.ok &&
          fresh &&
          result.outcome === "ok" &&
          CAMERA_ACTIONS.includes(result.action) &&
          typeof result.confidence === "number" &&
          result.confidence >= 0.8
            ? result.action
            : "unknown"
        const agreed = action !== "unknown" && action === candidate
        candidate = action
        clearInterval(motionTimer)
        previous = current
        clearTimeout(expiry)
        setView({
          action: agreed ? action : "unknown",
          loading: false,
          unavailable: false,
        })
        expiry = setTimeout(
          () => {
            setView(quiet)
            clearInterval(motionTimer)
          },
          Math.max(0, 2200 - age)
        )
        if (agreed)
          motionTimer = setInterval(() => {
            if (
              stopped ||
              element.paused ||
              element.ended ||
              document.visibilityState !== "visible" ||
              moved(observed, signature(element))
            ) {
              candidate = "unknown"
              setView(quiet)
              clearInterval(motionTimer)
            }
          }, 250)
        diagnostic("decision", {
          action,
          shown: agreed,
          confidence: result.confidence,
          ms: age,
          outcome: fresh ? result.outcome : "stale",
          progress: result.progress,
        })
        if (
          !response.ok &&
          [400, 403, 404, 429, 502, 503].includes(response.status)
        ) {
          stopped = true
          clearTimeout(expiry)
          setView({ ...quiet, unavailable: true })
        }
      } catch {
        if (!stopped && epoch === revision) {
          candidate = "unknown"
          stopped = true
          clearTimeout(expiry)
          clearInterval(motionTimer)
          setView({ ...quiet, unavailable: true })
          diagnostic("decision", {
            action: "unknown",
            shown: false,
            outcome: "unavailable",
            ms: performance.now() - started,
          })
        }
      } finally {
        releaseCanvas(canvas)
        request = null
        if (!stopped && budget.current >= 40) {
          clearTimeout(expiry)
          setView({ ...quiet, unavailable: true })
        }
        if (!stopped && budget.current < 40)
          timer = setTimeout(
            () => void loop(),
            Math.max(250, 1200 - (performance.now() - started))
          )
      }
    }
    void loop()
    return () => {
      stopped = true
      request?.abort()
      clearTimeout(timer)
      clearInterval(motionTimer)
      releaseCanvas(probe)
      clearTimeout(expiry)
      document.removeEventListener("visibilitychange", visible)
      live?.removeEventListener("resize", clear)
    }
  }, [active, aspect, slug, video])
  return active ? view : quiet
}
