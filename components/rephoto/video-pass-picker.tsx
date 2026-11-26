"use client"

import { useEffect, useRef, useState } from "react"

import { suggestMoment } from "@/lib/rephoto/pass-suggestion"
import {
  TRACE_OVERLAY_OPACITY,
  type ReferenceLines,
} from "@/lib/rephoto/reference-lines"
import type { VideoPass } from "@/lib/rephoto/video-pass"

import { ReferenceTrace } from "./reference-trace"

export function VideoPassPicker({
  pass,
  initialTime,
  guide,
  onUse,
  onBack,
}: {
  initialTime: number | null
  pass: VideoPass
  guide: ReferenceLines | null
  onUse: (frame: HTMLCanvasElement, time: number) => void
  onBack: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const analysis = useRef<AbortController | null>(null)
  const touched = useRef(initialTime !== null)
  const [loaded, setLoaded] = useState(false)
  const [time, setTime] = useState(0)
  const [end, setEnd] = useState(pass.seconds)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState("")
  const [note, setNote] = useState(
    guide && initialTime === null ? "Checking landmarks…" : "Choose a frame"
  )
  const [guides, setGuides] = useState(true)
  useEffect(() => {
    const src = URL.createObjectURL(pass.blob)
    const element = video.current!
    element.src = src
    const controller = new AbortController()
    analysis.current = controller
    if (guide && initialTime === null)
      void suggestMoment(
        src,
        pass.seconds,
        pass.aspect,
        guide,
        controller.signal
      )
        .then((suggestion) => {
          if (controller.signal.aborted || touched.current) return
          if (suggestion == null) {
            setNote("Choose a frame")
            return
          }
          const v = video.current
          if (!v || v.readyState < 2) {
            setNote("Choose a frame")
            return
          }
          v.pause()
          setReady(false)
          v.currentTime = suggestion
          setTime(suggestion)
          setNote("Suggested by matching landmarks")
        })
        .catch(() => {
          if (!controller.signal.aborted) setNote("Choose a frame")
        })
    return () => {
      controller.abort()
      element.removeAttribute("src")
      element.load()
      URL.revokeObjectURL(src)
    }
  }, [pass, guide, initialTime])
  const manual = () => {
    touched.current = true
    analysis.current?.abort()
    setNote("Choose a frame")
  }
  const seek = (at: number) => {
    const v = video.current
    if (!v) return
    manual()
    v.pause()
    setTime(at)
    v.currentTime = at
    setReady(!v.seeking && v.readyState >= 2)
  }
  const use = () => {
    const v = video.current
    if (!v || !ready || v.seeking || v.readyState < 2 || error) return
    manual()
    v.pause()
    const frame = document.createElement("canvas")
    frame.width = v.videoWidth
    frame.height = v.videoHeight
    const ctx = frame.getContext("2d")
    if (!ctx) return
    ctx.drawImage(v, 0, 0)
    onUse(frame, v.currentTime)
  }
  return (
    <section
      data-testid="video-pass-picker"
      className="fixed inset-0 z-[60] flex flex-col bg-black p-3 text-white landscape:flex-row landscape:gap-4"
    >
      <div
        style={{ containerType: "size" }}
        className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden"
      >
        <div
          className="relative max-h-full max-w-full"
          style={{
            aspectRatio: 1 / pass.aspect,
            width: `min(100cqw, ${100 / pass.aspect}cqh)`,
          }}
        >
          <video
            ref={video}
            playsInline
            muted
            preload="auto"
            aria-label="Recorded pass"
            className="block size-full object-fill"
            onLoadedData={(e) => {
              const v = e.currentTarget
              setLoaded(true)
              const length = Math.min(
                pass.seconds,
                Number.isFinite(v.duration) ? v.duration : pass.seconds
              )
              setEnd(Math.max(0, length - 0.05))
              if (initialTime !== null)
                v.currentTime = Math.min(initialTime, length)
              else if (!touched.current && length > 0.15)
                v.currentTime = length / 2
              setTime(v.currentTime)
              setReady(!v.seeking)
            }}
            onSeeking={() => setReady(false)}
            onSeeked={(e) => {
              setTime(e.currentTarget.currentTime)
              setReady(true)
            }}
            onTimeUpdate={(e) => {
              if (!e.currentTarget.seeking) setTime(e.currentTarget.currentTime)
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() =>
              setError(
                "This pass could not be opened. Return to the camera to try again."
              )
            }
          />
          {guides && guide && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={guide.image}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 size-full"
                style={{ opacity: TRACE_OVERLAY_OPACITY }}
              />
              <ReferenceTrace guide={guide} />
            </>
          )}
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-md shrink-0 flex-col gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] landscape:w-56 landscape:justify-center">
        <p role="status" className="text-center text-sm">
          {error || note}
        </p>
        <div className="flex items-center gap-3">
          <input
            aria-label="Frame time"
            type="range"
            min={0}
            max={end}
            step={0.05}
            value={Math.min(time, end)}
            disabled={!!error || !loaded}
            onChange={(e) => seek(Number(e.target.value))}
            className="h-11 min-w-0 flex-1 accent-white"
          />
          <output className="w-12 text-right text-sm tabular-nums">
            {time.toFixed(1)}s
          </output>
        </div>
        <div className="flex items-center justify-center gap-4 text-sm">
          <button
            type="button"
            className="min-h-11"
            disabled={!!error}
            onClick={() => {
              manual()
              const v = video.current
              if (v) {
                if (playing) v.pause()
                else
                  void v
                    .play()
                    .catch(() => setNote("Choose a frame with the slider"))
              }
            }}
          >
            {playing ? "Pause" : "Play pass"}
          </button>
          {guide && (
            <button
              type="button"
              className="min-h-11"
              aria-pressed={guides}
              onClick={() => {
                manual()
                setGuides(!guides)
              }}
            >
              Guides
            </button>
          )}
        </div>
        <div className="flex items-center justify-center gap-4">
          <button type="button" className="min-h-11 px-2" onClick={onBack}>
            Back to camera
          </button>
          <button
            type="button"
            disabled={!ready || !!error}
            className="min-h-11 rounded-full bg-white px-4 text-black disabled:opacity-40"
            onClick={use}
          >
            Use frame
          </button>
        </div>
      </div>
    </section>
  )
}
