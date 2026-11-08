"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Check, X } from "lucide-react"

import { align, prepareArchive, type Archive } from "@/lib/rephoto/align"
import { fits, releaseCanvas, renderCrop, type Crop } from "@/lib/rephoto/crop"
import { loadImage } from "@/lib/rephoto/pixels"

export type Shot = {
  // The real photograph, at the camera's full resolution.
  canvas: HTMLCanvasElement
  // Where the old photograph sat on screen when it was taken, kept if the matcher can't place it.
  crop: Crop
  // Whether that was the matcher's own placement, rather than the resting guide.
  locked: boolean
  archive: Archive | null
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

// The shot settles onto the archive view, then the archive fades away to leave the result.
const SETTLE_MS = 350

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
  const [aspect, setAspect] = useState(listedAspect)
  const stageRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const [crop, setCrop] = useState<Crop>(shot.crop)
  const [phase, setPhase] = useState<Phase>("aligning")
  const [settled, setSettled] = useState(false)
  const [peek, setPeek] = useState(false)
  const [note, setNote] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [renders, setRenders] = useState(0)
  const [renderFailed, setRenderFailed] = useState(false)
  const [saved, setSaved] = useState(false)
  const canShare =
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    "canShare" in navigator

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

  useEffect(() => {
    const controller = new AbortController()
    const photo = { width: shot.canvas.width, height: shot.canvas.height }
    let slow: ReturnType<typeof setTimeout> | undefined
    const run = async () => {
      try {
        const archive =
          shot.archive ??
          prepareArchive(
            await Promise.race([
              loadImage(thenSrc),
              new Promise<never>(
                (_, reject) =>
                  (slow = setTimeout(
                    () => reject(new Error("Slow archive")),
                    10_000
                  ))
              ),
            ])
          )
        controller.signal.throwIfAborted()
        setAspect(archive.aspect)
        const found = await align(
          archive,
          shot.canvas,
          photo,
          controller.signal,
          { server: true }
        )
        if (!found) throw new Error("No match")
        // The crop stays exactly on the old view, so the two line up. Where that view runs off
        // the photograph the corner is left black, never filled in, and the note says why.
        setCrop(found.crop)
        setNote(
          fits(found.crop, archive.aspect, photo)
            ? ""
            : "Step back to include the whole view."
        )
        setPhase("aligned")
      } catch {
        if (controller.signal.aborted) return
        // The live view had already placed it; that placement stands.
        if (shot.locked) return setPhase("aligned")
        setPhase("unmatched")
        setNote("Couldn’t align this photo.")
      }
    }
    void run()
    return () => {
      clearTimeout(slow)
      controller.abort()
    }
  }, [shot, thenSrc])

  useEffect(() => {
    if (phase === "aligning") return
    const timer = setTimeout(() => setSettled(true), SETTLE_MS + 150)
    return () => clearTimeout(timer)
  }, [phase])

  // The file is ready before the tap, so sharing runs straight from it (Safari requires that).
  // It's made from the framing at hand at once, and again when the matcher refines it.
  useEffect(() => {
    let current = true
    const canvas = document.createElement("canvas")
    const fail = () => current && setRenderFailed(true)
    try {
      renderCrop(shot.canvas, crop, aspect, canvas)
      canvas.toBlob(
        (blob) => {
          releaseCanvas(canvas)
          if (!current) return
          if (!blob) return fail()
          setRenderFailed(false)
          // A better framing arrived after saving: offer to save that one too.
          setSaved(false)
          setFile(
            new File([blob], `${slug}-now-${stamp(shot.takenAt)}.jpg`, {
              type: "image/jpeg",
            })
          )
        },
        "image/jpeg",
        0.92
      )
    } catch {
      releaseCanvas(canvas)
      fail()
    }
    return () => {
      current = false
      setFile(null)
    }
  }, [crop, aspect, shot, slug, renders])

  const save = async () => {
    if (!file) return
    try {
      if (canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name })
      } else {
        const url = URL.createObjectURL(file)
        const link = document.createElement("a")
        link.href = url
        link.download = file.name
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
      setSaved(true)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setNote("Couldn’t save. Try again.")
    }
  }

  const box = stage.width
    ? (() => {
        const width = Math.min(stage.width, stage.height / aspect)
        return {
          width,
          height: width * aspect,
          left: (stage.width - width) / 2,
          top: (stage.height - width * aspect) / 2,
        }
      })()
    : null
  const k = box ? box.width / crop.width : 1
  const ghostOpacity = peek || !settled ? 0.5 : 0

  return (
    <div
      data-testid="rephoto-review"
      data-crop={JSON.stringify(crop)}
      data-phase={phase}
      className="fixed inset-0 z-[60] flex flex-col bg-black text-white landscape:flex-row"
    >
      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
        {box && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Hold to see the old photo"
            data-testid="rephoto-review-frame"
            className="absolute touch-none select-none overflow-hidden bg-black outline-none [-webkit-touch-callout:none]"
            style={{
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
            }}
            onPointerDown={() => setPeek(true)}
            onPointerUp={() => setPeek(false)}
            onPointerCancel={() => setPeek(false)}
            onPointerLeave={() => setPeek(false)}
            onKeyDown={(event) => event.key === " " && setPeek(true)}
            onKeyUp={() => setPeek(false)}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div
              ref={holderRef}
              data-testid="rephoto-photo"
              className="pointer-events-none absolute left-0 top-0 transition-transform ease-out motion-reduce:transition-none [&>canvas]:absolute [&>canvas]:left-0 [&>canvas]:top-0 [&>canvas]:max-w-none"
              style={{
                transitionDuration: `${SETTLE_MS}ms`,
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
              className="pointer-events-none absolute inset-0 size-full transition-opacity duration-500"
              style={{ opacity: ghostOpacity }}
            />
          </div>
        )}
        {note && (
          <p
            data-testid="rephoto-note"
            role="status"
            className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]"
          >
            {note}
          </p>
        )}
        <Link
          href={`/${slug}`}
          aria-label="Close"
          className="absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-black/40"
        >
          <X className="size-5" aria-hidden />
        </Link>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 px-[max(1.25rem,env(safe-area-inset-left))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 landscape:flex-col-reverse landscape:justify-center landscape:py-4 landscape:pr-[max(1.25rem,env(safe-area-inset-right))]">
        <button
          type="button"
          data-testid="rephoto-retake"
          onClick={onRetake}
          className="min-h-11 px-4 text-base text-white/85"
        >
          Retake
        </button>
        {saved ? (
          <Link
            href={`/${slug}`}
            data-testid="rephoto-done"
            className="inline-flex min-h-11 min-w-32 items-center justify-center gap-2 rounded-md bg-white px-6 text-base font-medium text-black"
          >
            <Check className="size-4" aria-hidden />
            Done
          </Link>
        ) : (
          <button
            type="button"
            data-testid="rephoto-save"
            onClick={() =>
              renderFailed ? setRenders((n) => n + 1) : void save()
            }
            disabled={!file && !renderFailed}
            className="inline-flex min-h-11 min-w-32 items-center justify-center rounded-md bg-white px-6 text-base font-medium text-black disabled:opacity-60"
          >
            {renderFailed ? "Try again" : canShare ? "Share" : "Save photo"}
          </button>
        )}
      </div>
    </div>
  )
}
