"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  fits,
  outputSize,
  releaseCanvas,
  renderCrop,
  shrinkToFit,
  type Crop,
} from "@/lib/rephoto/crop"
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
} from "@/lib/rephoto/match"
import { dataUrlToFile, loadImage } from "@/lib/rephoto/pixels"

export type Shot = {
  // The real photograph, upright, at full resolution.
  canvas: HTMLCanvasElement
  // The whole frame as taken, saved alongside the aligned copy.
  uncropped: Blob | null
  // The levelled framing from the camera, kept if the photographs can't be matched.
  crop: Crop
  takenAt: Date
}

interface Props {
  name: string
  slug: string
  thenSrc: string
  aspect: number
  shot: Shot
  onRetake: () => void
}

type Phase = "aligning" | "aligned" | "unmatched"

function stamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function RephotoReview({
  name,
  slug,
  thenSrc,
  aspect: listedAspect,
  shot,
  onRetake,
}: Props) {
  // The archive file's own shape, once it has loaded; the camera usually knows it already.
  const [aspect, setAspect] = useState(listedAspect)
  const stageRef = useRef<HTMLDivElement>(null)
  const prepared = useRef<{ key: string; files: File[] } | null>(null)
  const output = useRef<HTMLCanvasElement | null>(null)
  const outputCanvas = () =>
    (output.current ??= document.createElement("canvas"))
  const [crop, setCrop] = useState<Crop>(shot.crop)
  const [phase, setPhase] = useState<Phase>("aligning")
  const [inliers, setInliers] = useState(0)
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const [overlay, setOverlay] = useState(true)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  // The real photograph is the captured canvas itself, placed into whichever frame shows it.
  const holderRef = useCallback(
    (holder: HTMLDivElement | null) => {
      if (holder) holder.appendChild(shot.canvas)
      else shot.canvas.remove()
    },
    [shot.canvas]
  )

  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setStage({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // The image matcher finds the archive view inside the shot; the crop then turns, zooms and
  // shifts onto it. Nothing else about the photograph changes.
  useEffect(() => {
    const controller = new AbortController()
    const photo = { width: shot.canvas.width, height: shot.canvas.height }
    const run = async () => {
      try {
        const then = await Promise.race([
          loadImage(thenSrc),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Archive photo timed out")),
              20_000
            )
          ),
        ])
        const old = matchPixels(then, then.naturalWidth, then.naturalHeight)
        const now = matchPixels(shot.canvas, photo.width, photo.height)
        // The phone's own graphics chip first; the site's server if that isn't there or fails.
        let raw = null
        if (canMatchLocally()) {
          // A warmed-up matcher answers in about a second; one still downloading on a slow
          // connection gets a short grace, then the server takes the shot.
          const local = new AbortController()
          const stop = () => local.abort()
          controller.signal.addEventListener("abort", stop)
          const timer = setTimeout(stop, localMatcherReady() ? 10_000 : 4_000)
          raw = await matchLocally(old.gray, now.gray, local.signal).catch(
            () => null
          )
          clearTimeout(timer)
          controller.signal.removeEventListener("abort", stop)
        }
        if (!raw) {
          // AbortSignal.any isn't in Safari before 17.4, so the deadline is wired by hand.
          const server = new AbortController()
          const stop = () => server.abort()
          controller.signal.addEventListener("abort", stop)
          const timer = setTimeout(stop, 25_000)
          try {
            raw = await requestMatches(old.gray, now.gray, server.signal)
          } finally {
            clearTimeout(timer)
            controller.signal.removeEventListener("abort", stop)
          }
        }
        if (controller.signal.aborted) return
        const matches = unplace(raw, old.placement, now.placement)
        const shape = then.naturalHeight / then.naturalWidth
        setAspect(shape)
        const fit = fitCrop(
          matches,
          shape,
          photo,
          cellSize(photo, now.placement)
        )
        if (!fit) {
          setPhase("unmatched")
          setNote(
            "Couldn’t match this to the old photo. Stand where it was taken and try again."
          )
          return
        }
        setInliers(fit.inliers)
        // The fit is kept exactly. Any corner of the old view that the shot didn't reach stays
        // black rather than being shrunk out of line or filled in.
        setCrop(fit.crop)
        if (!fits(fit.crop, shape, photo)) {
          setNote("Lined up. Step back a little next time to fill the corners.")
        }
        setPhase("aligned")
      } catch {
        if (controller.signal.aborted) return
        setPhase("unmatched")
        setNote("Couldn’t line this one up. Try again, or save it as it is.")
      }
    }
    void run()
    return () => controller.abort()
  }, [shot, thenSrc])

  // The frame on screen that shows the archive photograph's view.
  const box = (() => {
    if (!stage.width) return null
    const width = Math.min(stage.width, stage.height / aspect)
    return {
      width,
      height: width * aspect,
      left: (stage.width - width) / 2,
      top: (stage.height - width * aspect) / 2,
    }
  })()
  const k = box ? box.width / crop.width : 1

  const fileNames = {
    aligned: `${slug}-now-${stamp(shot.takenAt)}.jpg`,
    uncropped: `${slug}-now-${stamp(shot.takenAt)}-uncropped.jpg`,
  }
  const cropKey = `${crop.cx.toFixed(1)},${crop.cy.toFixed(1)},${crop.width.toFixed(1)},${crop.rotation.toFixed(5)}`

  // The files are ready before Save is pressed, so sharing runs straight from the tap.
  useEffect(() => {
    prepared.current = null
    if (phase === "aligning") return
    const timer = setTimeout(() => {
      const canvas = outputCanvas()
      renderCrop(shot.canvas, crop, aspect, canvas)
      canvas.toBlob(
        (blob) => {
          releaseCanvas(canvas)
          if (!blob) return
          const files = [
            new File([blob], fileNames.aligned, { type: "image/jpeg" }),
          ]
          if (shot.uncropped) {
            files.push(
              new File([shot.uncropped], fileNames.uncropped, {
                type: "image/jpeg",
              })
            )
          }
          prepared.current = { key: cropKey, files }
        },
        "image/jpeg",
        0.92
      )
    }, 350)
    return () => clearTimeout(timer)
    // cropKey stands for crop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropKey, shot, phase])

  const save = async () => {
    setSaving(true)
    try {
      let files =
        prepared.current?.key === cropKey ? prepared.current.files : null
      if (!files) {
        const canvas = outputCanvas()
        renderCrop(shot.canvas, crop, aspect, canvas)
        files = [
          dataUrlToFile(
            canvas.toDataURL("image/jpeg", 0.92),
            fileNames.aligned
          ),
        ]
        releaseCanvas(canvas)
        if (shot.uncropped)
          files.push(
            new File([shot.uncropped], fileNames.uncropped, {
              type: "image/jpeg",
            })
          )
      }
      const share = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean
      }
      if (share.canShare?.({ files }) && navigator.share) {
        try {
          await navigator.share({ files, title: `${name}, now` })
          setNote("Saved.")
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError"))
            throw error
        }
        return
      }
      for (const file of files) {
        const url = URL.createObjectURL(file)
        const link = document.createElement("a")
        link.href = url
        link.download = file.name
        document.body.appendChild(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10000)
      }
      setNote("Downloaded.")
    } catch {
      setNote("Couldn't save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  const size = outputSize(crop, aspect)

  return (
    <div
      data-testid="rephoto-review"
      data-crop={JSON.stringify(crop)}
      data-phase={phase}
      data-inliers={inliers}
      className="fixed inset-0 z-[60] flex flex-col bg-black text-white landscape:flex-row"
    >
      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
        {box && (
          <button
            type="button"
            aria-label={overlay ? "Hide the old photo" : "Show the old photo"}
            data-testid="rephoto-review-frame"
            className="absolute cursor-pointer touch-manipulation select-none overflow-hidden bg-black"
            style={{
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
            }}
            onClick={() => setOverlay((value) => !value)}
          >
            <div
              ref={holderRef}
              data-testid="rephoto-photo"
              className="pointer-events-none absolute left-0 top-0 transition-transform duration-700 ease-out motion-reduce:transition-none [&>canvas]:absolute [&>canvas]:left-0 [&>canvas]:top-0 [&>canvas]:max-w-none"
              style={{
                transformOrigin: "0 0",
                transform: `translate(${box.width / 2}px, ${box.height / 2}px) scale(${k}) rotate(${-crop.rotation}rad) translate(${-crop.cx}px, ${-crop.cy}px)`,
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thenSrc}
              alt=""
              aria-hidden
              draggable={false}
              data-testid="rephoto-review-ghost"
              className="pointer-events-none absolute inset-0 size-full transition-opacity duration-150"
              style={{ opacity: overlay ? 0.5 : 0 }}
            />
          </button>
        )}
        {(phase === "aligning" || note) && (
          <p
            data-testid="rephoto-note"
            role="status"
            className="pointer-events-none absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] mx-auto w-fit max-w-[85%] rounded-full bg-black/60 px-4 py-2 text-center text-sm leading-snug"
          >
            {phase === "aligning" ? (
              <span className="animate-pulse">Lining up…</span>
            ) : (
              note
            )}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 px-[max(1.25rem,env(safe-area-inset-left))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 landscape:flex-col-reverse landscape:justify-center landscape:py-4 landscape:pr-[max(1.25rem,env(safe-area-inset-right))]">
        <button
          type="button"
          data-testid="rephoto-retake"
          onClick={onRetake}
          className="min-h-11 rounded-full px-4 text-base text-white/85"
        >
          Retake
        </button>
        <span
          className="text-xs tabular-nums text-white/50"
          data-testid="rephoto-size"
        >
          {size.width}×{size.height}
        </span>
        <button
          type="button"
          data-testid="rephoto-save"
          onClick={() => void save()}
          disabled={saving || phase === "aligning"}
          className="min-h-11 rounded-full bg-white px-6 text-base font-medium text-black disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  )
}
