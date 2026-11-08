"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { align, FRAME_WIDTH, prepareFrame, prepareReference, type Similarity } from "@/lib/rephoto/align"
import { clampCrop, fits, outputSize, renderCrop, shrinkToFit, type Crop } from "@/lib/rephoto/crop"
import { dataUrlToFile, loadImage, toGray } from "@/lib/rephoto/pixels"

export type Shot = {
  // The real photograph, upright, at full resolution.
  canvas: HTMLCanvasElement
  // The camera's own file, saved alongside the aligned copy.
  original: Blob | null
  crop: Crop
  takenAt: Date
  // Experimental automatic fit, on with ?assist=1 while it is being tuned.
  assist: boolean
}

interface Props {
  name: string
  slug: string
  thenSrc: string
  aspect: number
  shot: Shot
  onRetake: () => void
}

type Pointer = { x: number; y: number }

const TAP_SLOP_PX = 8
const TAP_MS = 300

function toSimilarity(crop: Crop, width: number): Similarity {
  return { scale: crop.width / width, rotation: crop.rotation, tx: crop.cx / width, ty: crop.cy / width }
}

function toCrop(t: Similarity, width: number): Crop {
  return { cx: t.tx * width, cy: t.ty * width, width: t.scale * width, rotation: t.rotation }
}

function stamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function RephotoReview({ name, slug, thenSrc, aspect, shot, onRetake }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, Pointer>())
  const tap = useRef<{ x: number; y: number; at: number; moved: boolean } | null>(null)
  const prepared = useRef<{ key: string; files: File[] } | null>(null)
  const touched = useRef(false)
  const photo = { width: shot.canvas.width, height: shot.canvas.height }
  const [crop, setCrop] = useState<Crop>(shot.crop)
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const [overlay, setOverlay] = useState(true)
  const [auto, setAuto] = useState<{ before: Crop } | null>(null)
  const [note, setNote] = useState("Pinch, turn or drag to line it up. Tap to compare.")
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
      setStage({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Looks for a closer fit of the real shot to the archive view, starting from the framing the
  // person chose. Only a confident match moves the crop, and it can be undone.
  useEffect(() => {
    if (!shot.assist) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const then = await loadImage(thenSrc)
        if (cancelled) return
        const reference = prepareReference(toGray(then, then.naturalWidth, then.naturalHeight, 600))
        const frame = prepareFrame(toGray(shot.canvas, photo.width, photo.height, FRAME_WIDTH))
        const result = align(reference, frame, toSimilarity(shot.crop, photo.width))
        if (cancelled || !result?.locked) return
        const found = toCrop(result.transform, photo.width)
        const next = fits(found, aspect, photo) ? found : shrinkToFit(found, aspect, photo)
        // Someone who has already started adjusting keeps their own framing.
        if (touched.current) return
        setAuto({ before: shot.crop })
        setNote("Lined up automatically.")
        setCrop(next)
      } catch {
        // Automatic fitting is a convenience; the person's framing stands without it.
      }
    }, 60)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // The shot is fixed for this review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot])

  // The frame on screen that shows the archive photograph's view.
  const box = (() => {
    if (!stage.width) return null
    const width = Math.min(stage.width, stage.height / aspect)
    return { width, height: width * aspect, left: (stage.width - width) / 2, top: (stage.height - width * aspect) / 2 }
  })()
  const k = box ? box.width / crop.width : 1

  const update = useCallback(
    (next: (current: Crop) => Crop) => {
      touched.current = true
      setCrop((current) => clampCrop(current, next(current), aspect, photo))
      setAuto(null)
      setNote("")
    },
    // photo is derived from the fixed canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aspect, shot.canvas]
  )

  // A point on screen (relative to the frame's centre) and the photograph point under it.
  const photoPointAt = (c: Crop, sx: number, sy: number, scale: number) => {
    const cos = Math.cos(c.rotation)
    const sin = Math.sin(c.rotation)
    const x = sx / scale
    const y = sy / scale
    return { x: c.cx + cos * x - sin * y, y: c.cy + sin * x + cos * y }
  }

  const gesture = (before: Pointer[], after: Pointer[]) => {
    if (!box) return
    const centre = (list: Pointer[]) => ({
      x: list.reduce((sum, p) => sum + p.x, 0) / list.length - box.width / 2,
      y: list.reduce((sum, p) => sum + p.y, 0) / list.length - box.height / 2,
    })
    const m0 = centre(before)
    const m1 = centre(after)
    let zoom = 1
    let turn = 0
    if (before.length >= 2 && after.length >= 2) {
      const d0 = Math.hypot(before[1].x - before[0].x, before[1].y - before[0].y)
      const d1 = Math.hypot(after[1].x - after[0].x, after[1].y - after[0].y)
      zoom = d0 > 0 ? d1 / d0 : 1
      turn =
        Math.atan2(after[1].y - after[0].y, after[1].x - after[0].x) -
        Math.atan2(before[1].y - before[0].y, before[1].x - before[0].x)
      if (turn > Math.PI) turn -= 2 * Math.PI
      if (turn < -Math.PI) turn += 2 * Math.PI
    }
    update((current) => {
      const scale0 = box.width / current.width
      // The photograph follows the fingers: the point under them stays under them.
      const anchor = photoPointAt(current, m0.x, m0.y, scale0)
      const width = current.width / zoom
      const rotation = current.rotation - turn
      const scale1 = box.width / width
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      const x = m1.x / scale1
      const y = m1.y / scale1
      return { width, rotation, cx: anchor.x - (cos * x - sin * y), cy: anchor.y - (sin * x + cos * y) }
    })
  }

  const local = (event: React.PointerEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = local(event)
    pointers.current.set(event.pointerId, point)
    tap.current = pointers.current.size === 1 ? { ...point, at: performance.now(), moved: false } : null
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return
    const before = [...pointers.current.values()]
    const point = local(event)
    pointers.current.set(event.pointerId, point)
    const after = [...pointers.current.values()]
    if (tap.current && Math.hypot(point.x - tap.current.x, point.y - tap.current.y) > TAP_SLOP_PX) {
      tap.current.moved = true
    }
    if (!tap.current || tap.current.moved) {
      gesture(before, after)
    }
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    const t = tap.current
    if (t && !t.moved && performance.now() - t.at < TAP_MS) {
      setOverlay((value) => !value)
    }
    tap.current = null
  }

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!box) return
    const point = local(event as unknown as React.PointerEvent)
    const factor = Math.exp(-event.deltaY * 0.0015)
    if (event.shiftKey) {
      const turn = event.deltaY * 0.0008
      gesture([{ x: box.width / 2, y: box.height / 2 }, { x: box.width / 2 + 100, y: box.height / 2 }], [
        { x: box.width / 2, y: box.height / 2 },
        { x: box.width / 2 + 100 * Math.cos(turn), y: box.height / 2 + 100 * Math.sin(turn) },
      ])
      return
    }
    gesture([point, { x: point.x + 100, y: point.y }], [point, { x: point.x + 100 * factor, y: point.y }])
  }

  const fileNames = {
    aligned: `${slug}-now-${stamp(shot.takenAt)}.jpg`,
    original: `${slug}-now-${stamp(shot.takenAt)}-original.jpg`,
  }
  const cropKey = `${crop.cx.toFixed(1)},${crop.cy.toFixed(1)},${crop.width.toFixed(1)},${crop.rotation.toFixed(5)}`

  // The files are ready before Save is pressed, so sharing runs straight from the tap.
  useEffect(() => {
    prepared.current = null
    const timer = setTimeout(() => {
      const canvas = document.createElement("canvas")
      renderCrop(shot.canvas, crop, aspect, canvas)
      canvas.toBlob(
        (blob) => {
          if (!blob) return
          const files = [new File([blob], fileNames.aligned, { type: "image/jpeg" })]
          if (shot.original) {
            files.push(new File([shot.original], fileNames.original, { type: "image/jpeg" }))
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
  }, [cropKey, shot])

  const save = async () => {
    setSaving(true)
    try {
      let files = prepared.current?.key === cropKey ? prepared.current.files : null
      if (!files) {
        const canvas = document.createElement("canvas")
        renderCrop(shot.canvas, crop, aspect, canvas)
        files = [dataUrlToFile(canvas.toDataURL("image/jpeg", 0.92), fileNames.aligned)]
        if (shot.original) files.push(new File([shot.original], fileNames.original, { type: "image/jpeg" }))
      }
      const share = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
      if (share.canShare?.({ files }) && navigator.share) {
        try {
          await navigator.share({ files, title: `${name}, now` })
          setNote("Saved.")
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) throw error
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
      className="fixed inset-0 z-[60] flex flex-col bg-black text-white landscape:flex-row"
    >
      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
        {box && (
          <div
            data-testid="rephoto-review-frame"
            className="absolute touch-none select-none overflow-hidden bg-neutral-900"
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          >
            <div
              ref={holderRef}
              data-testid="rephoto-photo"
              className="pointer-events-none absolute left-0 top-0 [&>canvas]:absolute [&>canvas]:left-0 [&>canvas]:top-0 [&>canvas]:max-w-none"
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
          </div>
        )}
        {note && (
          <p
            data-testid="rephoto-note"
            className="pointer-events-none absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] mx-auto w-fit max-w-[85%] rounded-full bg-black/60 px-4 py-2 text-center text-sm leading-snug"
          >
            {note}
            {auto && (
              <button
                type="button"
                className="pointer-events-auto ml-2 underline underline-offset-4"
                onClick={() => {
                  setCrop(auto.before)
                  setAuto(null)
                  setNote("")
                }}
              >
                Undo
              </button>
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
        <span className="text-xs tabular-nums text-white/50" data-testid="rephoto-size">
          {size.width}×{size.height}
        </span>
        <button
          type="button"
          data-testid="rephoto-save"
          onClick={() => void save()}
          disabled={saving}
          className="min-h-11 rounded-full bg-white px-6 text-base font-medium text-black disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  )
}
