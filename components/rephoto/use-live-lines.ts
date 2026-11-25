"use client"

import { useEffect, useRef, useState, type RefObject } from "react"

import type { Crop } from "@/lib/rephoto/crop"
import {
  alignmentScore,
  checkLines,
  linedUp,
  scoreUsable,
  type Gray,
  type LineCheck,
} from "@/lib/rephoto/line-check"
import { consistentEdge, corroborated } from "@/lib/rephoto/line-feedback"
import { grayOf, loadImage } from "@/lib/rephoto/pixels"
import type { ReferenceLines } from "@/lib/rephoto/reference-lines"
import { diagnostic } from "@/lib/rephoto/telemetry"

type Reading = {
  check: LineCheck
  recognized: boolean
  possible: LineCheck["lines"]
  held: boolean
  score: number | null
}
export function useLiveLines(
  videoRef: RefObject<HTMLVideoElement | null>,
  guide: ReferenceLines | null,
  crop: Crop | null,
  aspect: number,
  enabled: boolean,
  recognized: boolean
) {
  const [reading, setReading] = useState<Reading | null>(null)
  const identity = useRef(false)
  useEffect(() => {
    identity.current = recognized
  }, [recognized])
  const rotation = crop?.rotation ?? 0
  const width = crop?.width,
    cx = crop?.cx,
    cy = crop?.cy
  useEffect(() => {
    const video = videoRef.current
    if (!enabled || !guide || !video || !width || cx == null || cy == null)
      return
    let cancelled = false
    let worker: Worker | undefined
    let archive: Gray | null = null
    const targetGuide = guide
    let generation = 0
    let sampleGeneration = 0
    let timer: ReturnType<typeof setTimeout>
    let expire: ReturnType<typeof setTimeout>
    let deadline: ReturnType<typeof setTimeout>
    let previousTime = -1
    let held = false,
      passes = 0
    let previous: LineCheck | null = null
    let tracked = new Set<number>()
    let logged = ""
    const reset = () => {
      tracked.clear()
      previous = null
      passes = 0
      held = false
      setReading(null)
    }
    const k = Math.min(1, 480 / width)
    const target = { cx: cx * k, cy: cy * k, width: width * k, rotation }
    let sampled = 0,
      known = false
    const later = () => {
      if (!cancelled)
        timer = setTimeout(() => void sample(), worker ? 250 : 500)
    }
    function useMainThread() {
      if (cancelled) return
      clearTimeout(timer)
      clearTimeout(deadline)
      if (worker) {
        worker.onmessage = null
        worker.onerror = null
        worker.terminate()
        worker = undefined
      }
      reset()
      later()
    }
    async function sample() {
      if (cancelled || !video || !archive) return
      if (
        document.hidden ||
        video.paused ||
        video.readyState < 2 ||
        video.currentTime === previousTime
      ) {
        later()
        return
      }
      previousTime = video.currentTime
      sampled = performance.now()
      sampleGeneration = generation
      known = identity.current
      try {
        const live = await grayOf(
          video,
          video.videoWidth * k,
          video.videoHeight * k
        )
        if (cancelled) return
        if (!live) {
          later()
          return
        }
        if (worker) {
          deadline = setTimeout(useMainThread, 1500)
          worker.postMessage({ live, crop: target, recognized: known }, [
            live.data.buffer,
          ])
        } else {
          accept(checkLines(targetGuide, archive, live, target, known))
        }
      } catch {
        if (!cancelled) {
          reset()
          later()
        }
      }
    }
    function accept(check: LineCheck) {
      if (cancelled) return
      clearTimeout(deadline)
      const trusted = known && identity.current
      if (
        document.hidden ||
        sampleGeneration !== generation ||
        performance.now() - sampled > 1500 ||
        (known && !trusted)
      ) {
        reset()
        later()
        return
      }
      const evidence = corroborated(check, targetGuide, aspect)
      // A positive edge requires two actual frames. A definite miss or
      // occlusion removes green immediately, independently for each line.
      const nextTracked = new Set<number>()
      const display = {
        ...check,
        lines: check.lines.map((l, i) => {
          const retained =
            tracked.has(i) && consistentEdge(l, previous?.lines[i])
          const measured = evidence || retained
          if (measured && l.state !== "unknown") nextTracked.add(i)
          const state =
            !measured || (l.state === "on" && previous?.lines[i].state !== "on")
              ? ("unknown" as const)
              : l.state
          return {
            ...l,
            state,
            offset:
              measured && (state !== "unknown" || l.state === "unknown")
                ? l.offset
                : null,
          }
        }),
      }
      const possible = evidence
        ? []
        : check.lines.filter(
            (l, i) =>
              !nextTracked.has(i) && consistentEdge(l, previous?.lines[i])
          )
      tracked = nextTracked
      previous = check
      const raw = alignmentScore(check, targetGuide)
      const on = display.lines.filter((l) => l.state === "on").length
      const off = display.lines.filter((l) => l.state === "off").length
      const ok = evidence && trusted && check.ok && linedUp(raw, held)
      passes = ok ? passes + 1 : 0
      held = ok && (held || passes >= 2)
      const score = evidence && trusted && scoreUsable(raw) ? raw.score : null
      setReading({
        check: display,
        held,
        score,
        recognized: trusted,
        possible,
      })
      clearTimeout(expire)
      expire = setTimeout(
        reset,
        Math.max(0, sampled + 1500 - performance.now())
      )
      const summary = [
        held,
        Math.round((score ?? -10) / 10),
        check.worst,
        on,
        off,
      ].join("/")
      if (summary !== logged) {
        logged = summary
        diagnostic("lines", {
          ok: held,
          score,
          on,
          off,
          worst: check.worst,
          worstOffset:
            check.worst == null ? null : check.lines[check.worst].offset,
          raw: raw?.score ?? null,
          weakest: raw?.weakest ?? null,
          measured: raw?.measured ?? 0,
          regions: raw?.regions ?? 0,
          passes,
        })
      }
      later()
    }
    async function start() {
      if (!width) return
      try {
        archive = await grayOf(
          await loadImage(targetGuide.image),
          width * k,
          width * k * aspect
        )
        if (cancelled || !archive) return
        try {
          worker = new Worker(
            new URL("../../lib/rephoto/line-worker.ts", import.meta.url),
            { type: "module" }
          )
          worker.onmessage = (event: MessageEvent<LineCheck>) =>
            accept(event.data)
          worker.onerror = useMainThread
          // Keep the one reference buffer for browsers that fail to load the module worker.
          worker.postMessage({ archive, guide: targetGuide })
        } catch {
          worker?.terminate()
          worker = undefined
        }
        void sample()
      } catch {
        if (!cancelled) reset()
      }
    }
    void start()
    const visibility = () => {
      if (document.hidden) {
        generation++
        reset()
      }
    }
    document.addEventListener("visibilitychange", visibility)
    return () => {
      cancelled = true
      clearTimeout(deadline)
      clearTimeout(timer)
      clearTimeout(expire)
      worker?.terminate()
      document.removeEventListener("visibilitychange", visibility)
      reset()
    }
  }, [videoRef, guide, width, cx, cy, rotation, aspect, enabled])
  return enabled && (!reading?.recognized || recognized) ? reading : null
}
