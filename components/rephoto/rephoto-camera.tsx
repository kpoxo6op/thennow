"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Smartphone, X } from "lucide-react"
import Link from "next/link"

import { RephotoReview, type Shot } from "@/components/rephoto/rephoto-review"
import { shrinkToFit } from "@/lib/rephoto/crop"
import { edgeOverlay, loadImage } from "@/lib/rephoto/pixels"
import { askForMotion, needsMotionPermission, screenAngle, tiltFromGravity } from "@/lib/rephoto/tilt"

interface Props {
  name: string
  slug: string
  thenSrc: string
  // The archive photograph's height over its width.
  aspect: number
}

type Ghost = "photo" | "edges" | "off"
type Box = { left: number; top: number; width: number; height: number }

// The archive frame sits a little inside the camera's view, so there is room to turn and slide
// the crop afterwards without running off the real photograph.
const GHOST_FILL = 0.9
const GHOSTS: Ghost[] = ["photo", "edges", "off"]
// Within this the phone counts as level, and the guide line says so.
const LEVEL_RADIANS = (0.5 * Math.PI) / 180
// Beyond this the phone is pointed at the ground or sky, or the reading is not to be trusted.
const MAX_TILT_RADIANS = (15 * Math.PI) / 180

function fit(aspect: number, width: number, height: number, fill = 1): { width: number; height: number } {
  const w = Math.min(width, height / aspect) * fill
  return { width: w, height: w * aspect }
}

function explain(error: unknown) {
  const name = error instanceof DOMException ? error.name : ""
  if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
    return "This browser can't open the camera here. Open thennow.nz over https in Safari or Chrome."
  }
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access was turned down. Allow the camera for this site in your browser settings, then try again."
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera was found on this device."
  }
  if (name === "NotReadableError") {
    return "Another app is using the camera. Close it, then try again."
  }
  return "The camera didn't start. Try again."
}

async function openCamera() {
  const attempts: MediaStreamConstraints[] = [
    {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        // Photographs are near 4:3; a 16:9 stream would throw away the sensor's top and bottom.
        aspectRatio: { ideal: 4 / 3 },
        width: { ideal: 4032 },
        height: { ideal: 3024 },
      },
    },
    { audio: false, video: { facingMode: { ideal: "environment" } } },
    { audio: false, video: true },
  ]
  let lastError: unknown = null
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (error) {
      lastError = error
      if (error instanceof DOMException && error.name === "NotAllowedError") break
    }
  }
  throw lastError
}

type ImageCaptureLike = { takePhoto: () => Promise<Blob> }

// A full-resolution still where the browser offers one with the same framing as the preview,
// otherwise the current video frame.
async function grabStill(video: HTMLVideoElement, track: MediaStreamTrack | undefined) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  const Capture = (globalThis as unknown as { ImageCapture?: new (t: MediaStreamTrack) => ImageCaptureLike })
    .ImageCapture

  if (Capture && track) {
    try {
      const blob = await Promise.race([
        new Capture(track).takePhoto(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("slow")), 4000)),
      ])
      const bitmap = await createImageBitmap(blob)
      const sameShape = Math.abs(bitmap.width / bitmap.height - vw / vh) < 0.02
      if (sameShape && bitmap.width >= vw) {
        const canvas = document.createElement("canvas")
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0)
        bitmap.close()
        return { canvas, blob }
      }
      bitmap.close()
    } catch {
      // Fall back to the video frame below.
    }
  }

  const canvas = document.createElement("canvas")
  canvas.width = vw
  canvas.height = vh
  canvas.getContext("2d")?.drawImage(video, 0, 0, vw, vh)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95))
  return { canvas, blob }
}

export function RephotoCamera({ name, slug, thenSrc, aspect }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<"starting" | "live" | "error">("starting")
  const [error, setError] = useState("")
  const [ghost, setGhost] = useState<Ghost>("photo")
  const [edges, setEdges] = useState<string | null>(null)
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 })
  const [shot, setShot] = useState<Shot | null>(null)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState(true)
  const [tilt, setTilt] = useState<number | null>(null)
  const tiltRef = useRef<number | null>(null)
  const askedMotion = useRef(false)

  // The page is the camera: nothing scrolls behind it.
  useLayoutEffect(() => {
    const { overflow } = document.documentElement.style
    document.documentElement.style.overflow = "hidden"
    return () => {
      document.documentElement.style.overflow = overflow
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadImage(thenSrc)
      .then((image) => {
        if (!cancelled) setEdges(edgeOverlay(image))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [thenSrc])

  useEffect(() => {
    const timer = setTimeout(() => setHint(false), 4500)
    return () => clearTimeout(timer)
  }, [])

  // The phone's lean, smoothed, from gravity. It levels the shot when it is taken.
  useEffect(() => {
    let smooth: number | null = null
    let shown = 0
    const onMotion = (event: DeviceMotionEvent) => {
      const g = event.accelerationIncludingGravity
      if (!g || g.x == null || g.y == null || g.z == null) return
      // Held flat, the screen has no up and down to level against.
      if (Math.hypot(g.x, g.y) < Math.abs(g.z) * 1.2) {
        smooth = null
        tiltRef.current = null
      } else {
        const angle = tiltFromGravity(g.x, g.y, screenAngle())
        smooth = smooth == null ? angle : smooth + (angle - smooth) * 0.2
        tiltRef.current = Math.abs(smooth) < MAX_TILT_RADIANS ? smooth : null
      }
      const now = performance.now()
      if (now - shown > 80) {
        shown = now
        setTilt(tiltRef.current)
      }
    }
    window.addEventListener("devicemotion", onMotion)
    return () => window.removeEventListener("devicemotion", onMotion)
  }, [])

  const askMotionOnce = () => {
    if (askedMotion.current || !needsMotionPermission()) return
    askedMotion.current = true
    void askForMotion()
  }

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    setStatus("starting")
    setError("")
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("no camera api")
      }
      const stream = await openCamera()
      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        stop()
        return
      }
      video.srcObject = stream
      await video.play().catch(() => {})
      setStatus("live")
    } catch (caught) {
      setError(explain(caught))
      setStatus("error")
    }
  }, [stop])

  useEffect(() => {
    if (shot) {
      return
    }
    // Starts after paint: the camera may ask permission straight away.
    const timer = setTimeout(() => {
      void start()
    }, 0)
    let lock: { release: () => Promise<void> } | null = null
    const wake = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<typeof lock> } })
      .wakeLock
    wake
      ?.request("screen")
      .then((sentinel) => {
        lock = sentinel
      })
      .catch(() => {})
    return () => {
      clearTimeout(timer)
      stop()
      lock?.release().catch(() => {})
    }
  }, [shot, start, stop])

  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setStage({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [shot])

  const onVideoSize = () => {
    const video = videoRef.current
    if (video?.videoWidth) setVideoSize({ width: video.videoWidth, height: video.videoHeight })
  }

  // Where the camera picture and the archive frame sit on screen.
  let view: Box | null = null
  let frame: Box | null = null
  if (videoSize.width && stage.width) {
    const shown = fit(videoSize.height / videoSize.width, stage.width, stage.height)
    view = {
      ...shown,
      left: (stage.width - shown.width) / 2,
      top: (stage.height - shown.height) / 2,
    }
    const target = fit(aspect, view.width, view.height, GHOST_FILL)
    frame = {
      ...target,
      left: view.left + (view.width - target.width) / 2,
      top: view.top + (view.height - target.height) / 2,
    }
  }

  // A landscape archive photograph wants a sideways phone, and a portrait one an upright phone.
  const turnSideways = aspect < 1 && stage.height > stage.width
  const holdUpright = aspect > 1 && stage.width > stage.height

  const capture = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth || busy) return
    setBusy(true)
    try {
      const track = streamRef.current?.getVideoTracks()[0]
      const { canvas, blob } = await grabStill(video, track)
      const photo = { width: canvas.width, height: canvas.height }
      // The framing the person lined up against the guide, carried over to the still.
      const target = fit(aspect, photo.width, photo.height, GHOST_FILL)
      // Level with the horizon, as the archive photograph almost certainly was.
      const rotation = tiltRef.current == null ? 0 : -tiltRef.current
      const crop = shrinkToFit(
        { cx: photo.width / 2, cy: photo.height / 2, width: target.width, rotation },
        aspect,
        photo
      )
      stop()
      const assist = new URLSearchParams(window.location.search).get("assist") === "1"
      setShot({ canvas, original: blob, crop, takenAt: new Date(), assist })
    } finally {
      setBusy(false)
    }
  }

  if (shot) {
    return (
      <RephotoReview
        name={name}
        slug={slug}
        thenSrc={thenSrc}
        aspect={aspect}
        shot={shot}
        onRetake={() => setShot(null)}
      />
    )
  }

  const nextGhost = () => {
    askMotionOnce()
    setGhost((current) => GHOSTS[(GHOSTS.indexOf(current) + 1) % GHOSTS.length])
  }

  return (
    <div data-testid="rephoto-camera" className="fixed inset-0 z-[60] flex flex-col bg-black text-white landscape:flex-row">
      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
        onClick={nextGhost}
        data-testid="rephoto-stage"
        data-ghost={ghost}
      >
        <video
          ref={videoRef}
          data-testid="rephoto-video"
          className="absolute inset-0 size-full object-contain"
          autoPlay
          muted
          playsInline
          onLoadedMetadata={onVideoSize}
          onResize={onVideoSize}
        />
        {frame && ghost !== "off" && (
          // A plain img: the archive photograph is drawn over live video at an exact box.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ghost === "edges" && edges ? edges : thenSrc}
            alt=""
            aria-hidden
            data-testid="rephoto-ghost"
            draggable={false}
            className="pointer-events-none absolute"
            style={{
              left: frame.left,
              top: frame.top,
              width: frame.width,
              height: frame.height,
              opacity: ghost === "photo" ? 0.5 : 1,
              filter: ghost === "edges" ? "drop-shadow(0 0 1px rgba(0,0,0,0.9))" : undefined,
            }}
          />
        )}
        {frame && (
          <div
            aria-hidden
            data-testid="rephoto-frame"
            className="pointer-events-none absolute border border-white/70"
            style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
          />
        )}

        {frame && tilt != null && (
          <div
            aria-hidden
            data-testid="rephoto-level"
            data-level={Math.abs(tilt) < LEVEL_RADIANS ? "true" : "false"}
            className="pointer-events-none absolute h-0.5 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
            style={{
              width: frame.width * 0.28,
              left: frame.left + frame.width * 0.36,
              top: frame.top + frame.height / 2 - 1,
              transform: `rotate(${-tilt}rad)`,
              background: Math.abs(tilt) < LEVEL_RADIANS ? "hsl(var(--accent))" : "rgba(255,255,255,0.85)",
            }}
          />
        )}

        {status === "starting" && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-white/70">
            Opening the camera…
          </p>
        )}
        {status === "error" && (
          <div
            className="absolute inset-x-6 top-1/2 mx-auto max-w-sm -translate-y-1/2 text-center"
            onClick={(event) => event.stopPropagation()}
          >
            <p data-testid="rephoto-error" className="text-base leading-snug">
              {error}
            </p>
            <button
              type="button"
              onClick={() => void start()}
              className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black"
            >
              Try again
            </button>
          </div>
        )}

        {status === "live" && (hint || turnSideways || holdUpright) && (
          <p
            data-testid="rephoto-hint"
            className="pointer-events-none absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] mx-auto w-fit max-w-[80%] rounded-full bg-black/55 px-4 py-2 text-center text-sm leading-snug"
          >
            {turnSideways || holdUpright ? (
              <span className="inline-flex items-center gap-2">
                <Smartphone className={turnSideways ? "size-4 rotate-90" : "size-4"} aria-hidden />
                {turnSideways ? "Turn the phone sideways" : "Hold the phone upright"}
              </span>
            ) : (
              "Line the old photo up with the view, then shoot. Tap to change the guide."
            )}
          </p>
        )}

        <Link
          href={`/${slug}`}
          aria-label={`Close the camera and go back to ${name}`}
          onClick={(event) => event.stopPropagation()}
          className="absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-black/45"
        >
          <X className="size-5" aria-hidden />
        </Link>
      </div>

      <div className="flex shrink-0 items-center justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 landscape:px-[max(1rem,env(safe-area-inset-right))] landscape:py-4">
        <button
          type="button"
          data-testid="rephoto-shutter"
          aria-label="Take the photo"
          disabled={status !== "live" || busy}
          onClick={() => {
            askMotionOnce()
            void capture()
          }}
          className="grid size-[4.5rem] place-items-center rounded-full border-4 border-white transition-transform active:scale-95 disabled:opacity-40"
        >
          <span className="size-14 rounded-full bg-white" />
        </button>
      </div>
    </div>
  )
}
