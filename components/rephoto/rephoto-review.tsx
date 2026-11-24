"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import Link from "next/link"
import { X } from "lucide-react"

import {
  align,
  NEAR_REACH,
  prepareArchive,
  type Archive,
} from "@/lib/rephoto/align"
import {
  fits,
  MAX_OUTPUT_WIDTH,
  releaseCanvas,
  renderCrop,
  type Crop,
} from "@/lib/rephoto/crop"
import {
  alignmentScore,
  checkLines,
  linedUp,
  scoreUsable,
  type LineCheck,
} from "@/lib/rephoto/line-check"
import { grayOf, loadImage } from "@/lib/rephoto/pixels"
import { referenceLines } from "@/lib/rephoto/reference-lines"
import { newKey, sendPhoto } from "@/lib/rephoto/submit"
import { diagnostic, report, submissionTag } from "@/lib/rephoto/telemetry"
import { ReferenceTrace } from "@/components/rephoto/reference-trace"

export type Shot = {
  // The real photograph, at the camera's full resolution.
  canvas: HTMLCanvasElement
  // Where the old photograph sat on screen when it was taken, kept if the matcher can't place it.
  crop: Crop
  // Whether that was the matcher's own placement, rather than the resting guide.
  locked: boolean
  // Fixed trace geometry must survive review and export unchanged.
  traced?: boolean
  assisted?: boolean
  assistanceLost?: boolean
  // The live score shown when the shot was taken, used if the shot itself can't be scored.
  liveScore?: number | null
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

// Unchecked: the photo couldn't be compared with the old one (no signal, matcher busy), which
// says nothing about the photo, so it can still be sent. Unmatched: it was compared and isn't
// the same view, so it can only be taken again.
type Phase = "aligning" | "framed" | "unchecked" | "unmatched"
type Sending =
  | "idle"
  | "sending"
  | "sent"
  | "offline"
  | "busy"
  | "limited"
  | "refused"

const NOT_SENT: Record<string, string> = {
  offline: "Not sent. Check your signal.",
  busy: "Not sent. Please try again in a minute.",
  limited:
    "Not sent. Many photos came from this network just now. Please try again later.",
  refused: "This photo can’t be sent. You can keep a copy.",
}

// The site takes up to 4 MB; stay well under it.
const MAX_SEND_BYTES = 3_500_000
const ENCODINGS: [number, number][] = [
  [MAX_OUTPUT_WIDTH, 0.85],
  [MAX_OUTPUT_WIDTH, 0.72],
  [1920, 0.72],
]

function toJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  )
}

// The framed photograph as a JPEG small enough to send. Drawn from a canvas, it carries no
// camera details or location.
async function encode(source: HTMLCanvasElement, crop: Crop, aspect: number) {
  const canvas = document.createElement("canvas")
  try {
    let blob: Blob | null = null
    for (const [width, quality] of ENCODINGS) {
      renderCrop(source, crop, aspect, canvas, width)
      blob = await toJpeg(canvas, quality)
      if (!blob || blob.size <= MAX_SEND_BYTES) break
    }
    return blob
  } finally {
    releaseCanvas(canvas)
  }
}

// The shot settles onto the archive view, then a line wipes the archive away to leave the result.
const SETTLE_MS = 350
const SWEEP_MS = 1100

class NoMatch extends Error {}

// The name already given on this phone, if any. Asking also gives the phone its cookie. Only one
// question is out at a time, so two answers can never bring two different cookies.
let asking: Promise<string | null> | null = null
function askMe() {
  asking ??= fetch("/api/me", {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((me) => (typeof me?.name === "string" ? me.name : null))
    .catch(() => null)
    .finally(() => {
      asking = null
    })
  return asking
}

function stamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// The view's width, in pixels, at which the shot's lines are checked.
// The same as the live check's, so the number after the shot matches the one shown before it.
const SCORE_WIDTH = 480

export function RephotoReview({
  name,
  slug,
  thenSrc,
  aspect: listedAspect,
  shot,
  onRetake,
}: Props) {
  const trace = shot.traced ? referenceLines(slug, thenSrc) : null
  const [aspect, setAspect] = useState(listedAspect)
  const stageRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const [crop, setCrop] = useState<Crop>(shot.crop)
  const [phase, setPhase] = useState<Phase>("aligning")
  // How well the reference lines sit on their edges in this shot, line by line.
  const [score, setScore] = useState<{
    value: number | null
    check: LineCheck
  } | null>(null)
  const [settled, setSettled] = useState(false)
  // The wipe from the old photograph to the new one, played once when the shot is placed.
  const [sweeping, setSweeping] = useState(false)
  // A hold that cut the wipe short shows the old photograph at once, without fading in.
  const [cut, setCut] = useState(false)
  // Once the photo has been held to compare, the wipe has nothing left to show.
  const heldRef = useRef(false)
  const [peek, setPeek] = useState(false)
  const [split, setSplit] = useState(0)
  const press = useRef<{ id: number; x: number; dragging: boolean } | null>(
    null
  )
  const [note, setNote] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [renders, setRenders] = useState(0)
  const [renderFailed, setRenderFailed] = useState(false)
  const [sending, setSending] = useState<Sending>("idle")
  const [saveNote, setSaveNote] = useState("")
  const [kept, setKept] = useState(false)
  // The name already given on this phone, if any. Asking also gives the phone its cookie, so the
  // photo goes out already linked to it.
  const [credit, setCredit] = useState<string | null>(null)
  // One key per framed file: sending it again, after a lost answer, keeps a single copy.
  const keyRef = useRef("")
  // Keeping a copy means the phone's photos. An iPhone puts a file there only through its share
  // sheet (Save Image); Android's share sheet offers people, not a save, so there it downloads.
  const canShare =
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    "canShare" in navigator &&
    (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1))

  const holderRef = useCallback(
    (holder: HTMLDivElement | null) => {
      if (holder) holder.appendChild(shot.canvas)
      else shot.canvas.remove()
    },
    [shot.canvas]
  )

  useEffect(() => {
    let current = true
    void askMe().then((name) => current && name && setCredit(name))
    return () => {
      current = false
    }
  }, [])

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
    const began = performance.now()
    const done = (
      result: string,
      details: Record<string, string | number | boolean> = {}
    ) =>
      report(
        "review",
        { ...details, live: shot.locked },
        {
          result,
          ms: Math.round(performance.now() - began),
        }
      )
    const run = async () => {
      if (shot.assistanceLost) {
        setNote("Framing changed while shooting. Try again.")
        setPhase("unmatched")
        done("unmatched")
        return
      }
      if (shot.traced && trace) {
        // Checked line by line against the shot, at the framing that fits it best: the human
        // eye sees a canopy off its line at once, so the score has to as well.
        let placed = shot.crop
        try {
          const image = await loadImage(thenSrc)
          controller.signal.throwIfAborted()
          const archive = shot.archive ?? prepareArchive(image)
          const found = await align(
            archive,
            shot.canvas,
            photo,
            controller.signal,
            { server: true }
          )
          if (found && fits(found.crop, archive.aspect, photo)) {
            placed = found.crop
            setCrop(found.crop)
          }
          // Neither matched now nor framed by the camera's match: the crop is just the resting
          // guide, and scoring it would blame lines that were never placed (20 Nov 2026: a 0).
          if (
            !(found && fits(found.crop, archive.aspect, photo)) &&
            !shot.locked
          )
            throw new Error("Unplaced")
          const k = Math.min(1, SCORE_WIDTH / placed.width)
          const live = await grayOf(
            shot.canvas,
            photo.width * k,
            photo.height * k
          )
          const old = await grayOf(
            image,
            placed.width * k,
            placed.width * k * archive.aspect
          )
          controller.signal.throwIfAborted()
          if (live && old) {
            const check = checkLines(trace, old, live, {
              cx: placed.cx * k,
              cy: placed.cy * k,
              width: placed.width * k,
              rotation: placed.rotation,
            })
            const scored = alignmentScore(check, trace)
            // Only what this shot itself shows: no borrowed live number (19 Nov: an 81 came from
            // the live score while the shot could be checked in one region only).
            // At least two parts of the scene measured (19 Nov: a well-lined-up shot whose
            // shaded TAKEAWAY sign couldn't be read got no score at all).
            const value = scoreUsable(scored) ? scored.score : null
            const lined = linedUp(scored, false)
            setScore({ value, check })
            const off = check.lines.filter(
              (line) => line.state === "off"
            ).length
            setNote(
              lined && off
                ? "Some edges differ. Drag to compare."
                : lined
                  ? "Lined up. Drag to compare."
                  : "Drag to compare edges."
            )
            diagnostic("score", {
              score: value,
              ok: lined,
              worst: check.worst,
              on: check.lines.filter((line) => line.state === "on").length,
              off,
              worstOffset:
                check.worst == null ? null : check.lines[check.worst].offset,
            })
            setPhase("unchecked")
            done("unchecked", { moved: 0 })
            return
          }
        } catch {
          if (controller.signal.aborted) return
        }
        setNote(
          shot.assisted
            ? "Framing adjusted. Drag to compare."
            : "Your framing. Drag to compare edges."
        )
        setPhase("unchecked")
        done("unchecked", { moved: 0 })
        return
      }
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
        // A view too far away to be found in the whole photo is looked for in its middle.
        const found =
          (await align(archive, shot.canvas, photo, controller.signal, {
            server: true,
          })) ??
          (await align(archive, shot.canvas, photo, controller.signal, {
            server: true,
            reach: NEAR_REACH,
          }))
        if (!found) throw new NoMatch()
        // The crop stays exactly on the old view, so the two line up. Where that view runs off
        // the photograph the corner is left black, never filled in, and the note says why.
        setCrop(found.crop)
        const whole = fits(found.crop, archive.aspect, photo)
        setNote(
          whole
            ? "Drag to compare edges. Retake if the edges differ."
            : "Step back to include the whole view."
        )
        done("framed", {
          whole,
          moved: Math.round(
            (Math.hypot(
              found.crop.cx - shot.crop.cx,
              found.crop.cy - shot.crop.cy
            ) /
              shot.crop.width) *
              100
          ),
          zoom: Math.round((found.crop.width / photo.width) * 100),
          turn: Math.round((found.crop.rotation * 180) / Math.PI),
        })
        setPhase("framed")
      } catch (error) {
        if (controller.signal.aborted) return
        done(error instanceof NoMatch ? "unmatched" : "unchecked", {
          why: String(error).slice(0, 120),
        })
        const listed = shot.archive?.aspect ?? listedAspect
        const partial = !fits(shot.crop, listed, photo)
        if (error instanceof NoMatch) {
          setPhase("unmatched")
          setNote("The views don’t line up. Try another nearby viewpoint.")
          return
        }
        // Not compared at all: the photo is kept as framed, and may still be sent.
        setNote(
          partial
            ? "Step back to include the whole view."
            : "Couldn’t check alignment. Drag to compare edges."
        )
        setPhase("unchecked")
      }
    }
    void run()
    return () => {
      clearTimeout(slow)
      controller.abort()
    }
  }, [shot, thenSrc, listedAspect, trace])

  useEffect(() => {
    if (phase === "aligning") return
    // Without motion, or for a view that doesn't match, the old photograph simply fades.
    const still =
      phase === "unmatched" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let end: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(
      () => {
        setSettled(true)
        if (still || heldRef.current) return
        setSweeping(true)
        // A hidden tab may never finish the animation; the wipe still ends.
        end = setTimeout(() => setSweeping(false), SWEEP_MS + 300)
      },
      SETTLE_MS + (still ? 150 : 0)
    )
    return () => {
      clearTimeout(timer)
      clearTimeout(end)
    }
  }, [phase])

  // Holding the photo to compare takes over from the wipe.
  const hold = () => {
    heldRef.current = true
    if (sweeping) setCut(true)
    setSweeping(false)
    setPeek(true)
  }
  const release = () => {
    setCut(false)
    setPeek(false)
  }

  // The file is ready before the tap, so sharing runs straight from it (Safari requires that).
  // It's made from the framing at hand at once, and again when the matcher refines it.
  useEffect(() => {
    let current = true
    encode(shot.canvas, crop, aspect)
      .then((blob) => {
        if (!current) return
        if (!blob) return setRenderFailed(true)
        setRenderFailed(false)
        keyRef.current = newKey()
        setFile(
          new File([blob], `${slug}-now-${stamp(shot.takenAt)}.jpg`, {
            type: "image/jpeg",
          })
        )
      })
      .catch(() => current && setRenderFailed(true))
    return () => {
      current = false
      setFile(null)
    }
  }, [crop, aspect, shot, slug, renders])

  // Leaving the site while a photo is on its way would lose it; the browser asks first.
  useEffect(() => {
    if (sending !== "sending") return
    const hold = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", hold)
    return () => window.removeEventListener("beforeunload", hold)
  }, [sending])

  // Set at once, so a quick second tap can't start a second send before the screen updates.
  useEffect(() => {
    if (phase === "aligning") return
    diagnostic("framing", {
      phase,
      cropX: crop.cx / shot.canvas.width,
      cropY: crop.cy / shot.canvas.height,
      cropWidth: crop.width / shot.canvas.width,
      cropRotation: crop.rotation,
      aspect,
    })
  }, [phase, crop, aspect, shot])
  const sendingRef = useRef(false)
  const send = async () => {
    if (!file || sendingRef.current) return
    sendingRef.current = true
    setSending("sending")
    const began = performance.now()
    // The cookie comes first, so a first photo is sent and filed under the cookie the phone keeps.
    await askMe()
    const key = keyRef.current
    const result = await sendPhoto(file, {
      slug,
      key,
      // Coarse framing has not passed a photographic accuracy check.
      checked: false,
    })
    report(
      "send",
      {
        bytes: file.size,
        phase,
        ms: Math.round(performance.now() - began),
        submissionTag: await submissionTag(key),
      },
      { result }
    )
    sendingRef.current = false
    setSaveNote("")
    setSending(result)
  }

  const save = async () => {
    if (!file) return
    const saving = file
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
        // Says where it went. A share sheet's finish proves nothing was saved, so it says nothing.
        setKept(true)
      }
      report(
        "save",
        { bytes: saving.size },
        { how: canShare ? "share" : "download", phase }
      )
    } catch (error) {
      const cancelled =
        error instanceof DOMException && error.name === "AbortError"
      report(
        "save failed",
        { message: String(error).slice(0, 200) },
        { cancelled }
      )
      if (!cancelled) setSaveNote("Couldn’t keep a copy.")
    }
  }

  if (sending === "sent") {
    return (
      <div
        data-testid="rephoto-sent"
        className="fixed inset-0 z-[60] flex flex-col items-center justify-center-safe gap-8 overflow-y-auto bg-black px-6 py-8 text-center text-white"
      >
        <div role="status" className="max-w-md space-y-3">
          <h1 className="font-serif text-4xl leading-tight">Thank you.</h1>
          <p className="text-lg leading-snug text-white/85">
            Your photo has been sent. We look at every photo before it goes on
            the site.
          </p>
        </div>
        <Link
          href={`/${slug}`}
          data-testid="rephoto-done"
          className="inline-flex min-h-12 min-w-40 items-center justify-center rounded-md bg-white px-8 text-lg font-medium text-black"
        >
          Done
        </Link>
        {file && (
          <button
            type="button"
            data-testid="rephoto-save"
            onClick={() => void save()}
            className="min-h-11 text-base text-white/85 underline underline-offset-4"
          >
            {saveNote || (kept ? "In your Downloads" : "Keep a copy")}
          </button>
        )}
        <Link
          href="/me"
          data-testid="rephoto-your-photos"
          className="inline-flex min-h-11 items-center text-base text-white/85 underline underline-offset-4"
        >
          {credit ? `Sent as ${credit}` : "Sign up to be credited"}
        </Link>
      </div>
    )
  }

  const busy = sending === "sending"
  const failed =
    sending === "offline" ||
    sending === "busy" ||
    sending === "limited" ||
    sending === "refused"
  const sendable = phase === "framed" || phase === "unchecked"
  const status = saveNote || (failed ? NOT_SENT[sending] : note)

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
  const comparing = split > 0 && !peek
  const ghostOpacity = peek || comparing ? 1 : !settled ? 0.5 : 0

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
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={peek ? 100 : split}
            tabIndex={0}
            aria-label="Old photo reveal"
            title="Drag or use the arrow keys to compare. Hold the photo or Space to see the old photo."
            data-testid="rephoto-review-frame"
            className="absolute touch-none select-none overflow-hidden bg-black focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white [-webkit-touch-callout:none]"
            style={{
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
            }}
            onPointerDown={(event) => {
              if (!event.isPrimary || event.button !== 0) return
              press.current = {
                id: event.pointerId,
                x: event.clientX,
                dragging: false,
              }
              event.currentTarget.setPointerCapture(event.pointerId)
              hold()
            }}
            onPointerMove={(event) => {
              const start = press.current
              if (!start || start.id !== event.pointerId) return
              if (!start.dragging && Math.abs(event.clientX - start.x) < 6)
                return
              start.dragging = true
              const rect = event.currentTarget.getBoundingClientRect()
              setPeek(false)
              setSplit(
                Math.round(
                  100 *
                    Math.max(
                      0,
                      Math.min(1, (event.clientX - rect.left) / rect.width)
                    )
                )
              )
            }}
            onLostPointerCapture={(event) => {
              if (press.current?.id !== event.pointerId) return
              press.current = null
              release()
            }}
            onKeyDown={(event) => {
              if (event.key === " ") {
                event.preventDefault()
                hold()
                return
              }
              const step = {
                ArrowRight: 5,
                ArrowUp: 5,
                ArrowLeft: -5,
                ArrowDown: -5,
              }[event.key]
              if (step === undefined && !["Home", "End"].includes(event.key))
                return
              event.preventDefault()
              heldRef.current = true
              setSweeping(false)
              release()
              setSplit((current) =>
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? 100
                    : Math.max(0, Math.min(100, current + (step ?? 0)))
              )
            }}
            onKeyUp={(event) => event.key === " " && release()}
            onBlur={release}
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
              className={`pointer-events-none absolute inset-0 size-full ${sweeping || cut || comparing ? "" : "transition-opacity duration-500"}`}
              style={{
                opacity: ghostOpacity,
                clipPath: comparing
                  ? `inset(0 ${100 - split}% 0 0)`
                  : undefined,
              }}
            />
            {comparing && split < 100 && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-white"
                style={{ left: `${split}%` }}
              />
            )}
            {/* Mounted ahead, so the wipe starts on an already decoded picture. */}
            <div
              aria-hidden
              data-testid="rephoto-sweep"
              data-sweeping={sweeping || undefined}
              className="pointer-events-none absolute inset-0"
              style={{ "--sweep-ms": `${SWEEP_MS}ms` } as CSSProperties}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thenSrc}
                alt=""
                draggable={false}
                className={`absolute inset-0 size-full ${sweeping ? "tn-sweep" : "opacity-0"}`}
                onAnimationEnd={() => setSweeping(false)}
              />
              {sweeping && (
                <div className="tn-sweep-line absolute inset-0">
                  <div className="absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_1px_rgba(0,0,0,0.5),0_0_12px_2px_rgba(255,255,255,0.7)]" />
                </div>
              )}
            </div>
            {trace && !peek && !comparing && settled && !sweeping && (
              <ReferenceTrace
                guide={trace}
                confirmed={
                  score
                    ? score.check.lines
                        .filter((line) => line.state === "on")
                        .map((line) => line.index)
                    : []
                }
                off={
                  score
                    ? score.check.lines
                        .filter((line) => line.state === "off")
                        .map((line) => line.index)
                    : []
                }
              />
            )}
          </div>
        )}
        {score?.value != null && (
          <div
            data-testid="rephoto-score"
            data-score={score.value}
            className="pointer-events-none absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] rounded-2xl bg-black/65 px-3 py-1.5 text-center"
          >
            <div
              className={`text-2xl font-semibold tabular-nums ${score.value >= 85 ? "text-lime-300" : score.value >= 60 ? "text-amber-300" : "text-red-400"}`}
            >
              {score.value}/100
            </div>
            <div className="text-xs text-white/75">Guide score</div>
          </div>
        )}
        {status && (
          <p
            data-testid="rephoto-note"
            role="status"
            className="pointer-events-none absolute inset-x-4 bottom-3 text-balance text-center text-base text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]"
          >
            {status}
          </p>
        )}
        {!busy && (
          <Link
            href={`/${slug}`}
            aria-label="Close"
            className="absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-black/40"
          >
            <X className="size-5" aria-hidden />
          </Link>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 px-[max(1.25rem,env(safe-area-inset-left))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 landscape:w-56 landscape:flex-col-reverse landscape:justify-center landscape:py-4 landscape:pr-[max(1.25rem,env(safe-area-inset-right))]">
        {phase !== "unmatched" && (
          <button
            type="button"
            data-testid="rephoto-retake"
            onClick={onRetake}
            disabled={busy}
            className="min-h-11 px-4 text-base text-white/85 disabled:opacity-40"
          >
            Retake
          </button>
        )}
        <div className="flex min-w-0 flex-1 flex-col items-end gap-2 landscape:flex-none landscape:items-stretch">
          {phase === "unmatched" ? (
            <button
              type="button"
              data-testid="rephoto-again"
              onClick={onRetake}
              className="inline-flex min-h-12 min-w-40 items-center justify-center rounded-md bg-white px-6 text-lg font-medium text-black"
            >
              Retake
            </button>
          ) : sending === "refused" ? null : (
            <button
              type="button"
              data-testid="rephoto-send"
              onClick={() =>
                renderFailed ? setRenders((n) => n + 1) : void send()
              }
              disabled={busy || (!renderFailed && (!sendable || !file))}
              aria-busy={busy || phase === "aligning"}
              className="inline-flex min-h-12 min-w-40 items-center justify-center rounded-md bg-white px-6 text-lg font-medium text-black disabled:opacity-60"
            >
              {phase === "aligning"
                ? "Lining up…"
                : busy
                  ? "Sending…"
                  : failed
                    ? "Send again"
                    : renderFailed
                      ? "Try again"
                      : "Send photo"}
            </button>
          )}
          {!failed && phase !== "unmatched" && (
            <p
              data-testid="rephoto-consent"
              className="max-w-72 text-right text-sm leading-snug text-white/75 landscape:text-center"
            >
              By sending, you let then|now publish this photo. We don’t collect
              your location.
            </p>
          )}
          {file && !busy && phase !== "aligning" && (
            <button
              type="button"
              data-testid="rephoto-save"
              onClick={() => void save()}
              className="min-h-11 text-base text-white underline underline-offset-4"
            >
              {kept ? "In your Downloads" : "Keep a copy"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
