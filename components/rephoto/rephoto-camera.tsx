"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Smartphone, X } from "lucide-react"

import { align, prepareArchive, type Archive } from "@/lib/rephoto/align"
import { fits, releaseCanvas, shrinkToFit, type Crop } from "@/lib/rephoto/crop"
import {
  canMatchLocally,
  localMatcherReady,
  prepareLocalMatcher,
} from "@/lib/rephoto/local-matcher"
import { loadImage } from "@/lib/rephoto/pixels"
import { screenAngle, tiltFromGravity } from "@/lib/rephoto/tilt"
import { RephotoReview, type Shot } from "@/components/rephoto/rephoto-review"

interface Props {
  name: string
  slug: string
  thenSrc: string
  // Height over width, as listed; the file's own shape replaces it once loaded.
  aspect: number
}

type Box = { left: number; top: number; width: number; height: number }

// The resting guide sits a little inside the camera's view, leaving room to turn the crop.
const GHOST_FILL = 0.9
const GHOST_OPACITY = 0.4
const MAX_TILT_RADIANS = (15 * Math.PI) / 180

function fit(aspect: number, width: number, height: number, fill = 1) {
  const w = Math.min(width, height / aspect) * fill
  return { width: w, height: w * aspect }
}

function explain(error: unknown) {
  const name = error instanceof DOMException ? error.name : ""
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Allow camera access in your browser settings."
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "No camera found."
  if (name === "NotReadableError")
    return "Camera unavailable. Close other camera apps."
  if (!navigator.mediaDevices?.getUserMedia)
    return "Open this page in Safari or Chrome."
  return "Couldn’t open camera."
}

// A camera already allowed answers in a moment; one that doesn't is stuck (seen in Firefox on
// Android), so the next, plainer request is tried. While a permission prompt is up there's no limit.
async function cameraAllowed() {
  try {
    const status = await navigator.permissions.query({
      name: "camera" as PermissionName,
    })
    return status.state === "granted"
  } catch {
    return false
  }
}

function timeLimit<T>(
  promise: Promise<T>,
  ms: number,
  onLate: (value: T) => void
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        // A stream that turns up after giving up is let go.
        void promise.then(onLate, () => {})
        reject(new DOMException("Camera timed out", "TimeoutError"))
      }, ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

const stopStream = (stream: MediaStream) =>
  stream.getTracks().forEach((track) => track.stop())

// ?debug on the camera page lists each step of opening the camera, for phones without devtools.
const debugLines: string[] = []
let onDebug: (() => void) | null = null
function debug(line: string) {
  if (typeof location === "undefined" || !location.search.includes("debug"))
    return
  debugLines.push(`${(performance.now() / 1000).toFixed(1)} ${line}`)
  onDebug?.()
}

async function openCamera(plain: boolean) {
  const all: MediaStreamConstraints[] = [
    {
      audio: false,
      // Old photographs are near 4:3; a 16:9 stream would throw away the sensor's top and bottom.
      video: {
        facingMode: { ideal: "environment" },
        aspectRatio: { ideal: 4 / 3 },
        width: { ideal: 4032 },
        height: { ideal: 3024 },
      },
    },
    { audio: false, video: { facingMode: { ideal: "environment" } } },
    { audio: false, video: true },
  ]
  const attempts = plain ? all.slice(1) : all
  const allowed = await cameraAllowed()
  debug(`allowed ${allowed}`)
  let lastError: unknown = null
  for (const constraints of attempts) {
    try {
      debug(`getUserMedia ${JSON.stringify(constraints.video)}`)
      const request = navigator.mediaDevices.getUserMedia(constraints)
      const stream = allowed
        ? await timeLimit(request, 5000, stopStream)
        : await request
      const track = stream.getVideoTracks()[0]
      debug(
        `stream ${track?.readyState} muted=${track?.muted} ${JSON.stringify(track?.getSettings())}`
      )
      return stream
    } catch (error) {
      debug(`failed ${String(error)}`)
      lastError = error
      if (error instanceof DOMException && error.name === "NotAllowedError")
        break
    }
  }
  throw lastError
}

// The video frame itself, not a full-resolution still: some phones' stills see a wider view than
// the preview, which would move the framing.
function grabFrame(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas")
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas
}

export function RephotoCamera({
  name,
  slug,
  thenSrc,
  aspect: listedAspect,
}: Props) {
  const [aspect, setAspect] = useState(listedAspect)
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const archiveRef = useRef<Archive | null>(null)
  const tiltRef = useRef<number | null>(null)
  // How long the latest live placement stays good for: one round of matching and a bit more.
  const lockLife = useRef(2500)
  const attempt = useRef(0)
  const plain = useRef(false)
  const [status, setStatus] = useState<"starting" | "live" | "error">(
    "starting"
  )
  const [error, setError] = useState("")
  const [stage, setStage] = useState({ width: 0, height: 0 })
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 })
  const [shot, setShot] = useState<Shot | null>(null)
  const shotRef = useRef<Shot | null>(null)
  useEffect(() => {
    shotRef.current = shot
  }, [shot])
  // The camera's picture stopped for a moment (a notification, Control Center).
  const [interrupted, setInterrupted] = useState(false)
  const [debugText, setDebugText] = useState("")
  useEffect(() => {
    onDebug = () => setDebugText(debugLines.join("\n"))
    return () => {
      onDebug = null
    }
  }, [])
  const [peek, setPeek] = useState(false)
  // Where the archive view sits in the live picture, once the matcher has found it.
  const [lock, setLock] = useState<{
    crop: Crop
    // Found twice running in the same place.
    held: boolean
    // Held, and the whole old view is inside the picture: ready to shoot.
    steady: boolean
    at: number
  } | null>(null)

  useEffect(() => {
    prepareLocalMatcher()?.catch(() => {})
    // Leaving the camera from the review hands the shot's memory back.
    return () => {
      if (shotRef.current) releaseCanvas(shotRef.current.canvas)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadImage(thenSrc)
      .then((image) => {
        if (cancelled || !image.naturalWidth) return
        setAspect(image.naturalHeight / image.naturalWidth)
        archiveRef.current = prepareArchive(image)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [thenSrc])

  // The phone's lean, from gravity, levels a shot the matcher can't place. Read only where the
  // browser gives it without asking: an iPhone permission prompt isn't worth the interruption.
  useEffect(() => {
    let smooth: number | null = null
    const onMotion = (event: DeviceMotionEvent) => {
      const g = event.accelerationIncludingGravity
      if (!g || g.x == null || g.y == null || g.z == null) return
      if (Math.hypot(g.x, g.y) < Math.abs(g.z) * 1.2) {
        // Held flat, the screen has no up and down.
        smooth = null
      } else {
        const angle = tiltFromGravity(g.x, g.y, screenAngle())
        smooth = smooth == null ? angle : smooth + (angle - smooth) * 0.2
      }
      tiltRef.current =
        smooth != null && Math.abs(smooth) < MAX_TILT_RADIANS ? smooth : null
    }
    window.addEventListener("devicemotion", onMotion)
    return () => window.removeEventListener("devicemotion", onMotion)
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const restart = useRef(async () => {})
  const start = useCallback(async () => {
    // Only the latest start keeps its camera; an older one that finishes late lets it go.
    const mine = ++attempt.current
    stop()
    setStatus("starting")
    try {
      const stream = await openCamera(plain.current)
      const video = videoRef.current
      if (mine !== attempt.current || !video) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      video.srcObject = stream
      try {
        debug("play")
        await timeLimit(video.play(), 5000, () => {})
        debug(`playing ${video.videoWidth}x${video.videoHeight}`)
      } catch (error) {
        debug(`play failed ${String(error)} ready=${video.readyState}`)
        // Some browsers only play after a tap; the button is that tap. A camera that never
        // started is asked for plainly next time.
        plain.current = true
        if (mine !== attempt.current) return
        stop()
        setError("")
        setStatus("error")
        return
      }
      if (mine !== attempt.current) return
      setStatus("live")
      setInterrupted(false)
      const track = stream.getVideoTracks()[0]
      // The screen locked, a call came in, another app took the camera.
      track?.addEventListener("ended", () => {
        if (mine !== attempt.current) return
        setError("Camera paused.")
        setStatus("error")
      })
      track?.addEventListener("mute", () => {
        if (mine !== attempt.current) return
        setInterrupted(true)
        // A picture that stays stopped gets the camera opened again.
        setTimeout(() => {
          if (mine === attempt.current && track.muted) void restart.current()
        }, 3000)
      })
      track?.addEventListener("unmute", () => {
        if (mine === attempt.current) setInterrupted(false)
      })
    } catch (caught) {
      plain.current = true
      if (mine !== attempt.current) return
      setError(explain(caught))
      setStatus("error")
    }
  }, [stop])
  useEffect(() => {
    restart.current = start
  }, [start])

  useEffect(() => {
    if (shot) return
    const attempts = attempt
    const timer = setTimeout(() => void start(), 0)
    let lock: { release: () => Promise<void> } | null = null
    let ended = false
    const wake = (
      navigator as unknown as {
        wakeLock?: { request: (t: "screen") => Promise<typeof lock> }
      }
    ).wakeLock
    const keepAwake = () =>
      wake
        ?.request("screen")
        .then((sentinel) => {
          if (ended) void sentinel?.release()
          else lock = sentinel
        })
        .catch(() => {})
    void keepAwake()
    // The camera is let go while the page is out of sight and opened again on return. A
    // camera kept open in a background tab goes dead once another app takes it (Firefox on
    // Android), and every later request in that browser then shares the dead one.
    const onVisible = () => {
      if (document.visibilityState !== "visible") {
        attempts.current++
        stop()
        return
      }
      void keepAwake()
      void start()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      ended = true
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
      attempts.current++
      stop()
      lock?.release().catch(() => {})
    }
  }, [shot, start, stop])

  // A picture that stops without the camera saying so (Firefox on Android when another app took
  // the camera) is noticed by its frames and the camera opened again.
  useEffect(() => {
    const video = videoRef.current as
      | (HTMLVideoElement & {
          requestVideoFrameCallback?: (callback: () => void) => number
          cancelVideoFrameCallback?: (handle: number) => void
        })
      | null
    if (status !== "live" || !video?.requestVideoFrameCallback) return
    let last = performance.now()
    let handle = 0
    const onFrame = () => {
      last = performance.now()
      handle = video.requestVideoFrameCallback!(onFrame)
    }
    handle = video.requestVideoFrameCallback(onFrame)
    const watch = setInterval(() => {
      if (document.visibilityState !== "visible") last = performance.now()
      else if (performance.now() - last > 3000) {
        debug("no frames")
        last = performance.now()
        void restart.current()
      }
    }, 1000)
    return () => {
      clearInterval(watch)
      video.cancelVideoFrameCallback?.(handle)
    }
  }, [status])

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
  }, [shot])

  // Live: about once a second, the matcher looks for the archive view in the preview and the old
  // photograph moves onto it. Phones without on-device matching keep the resting guide.
  useEffect(() => {
    if (shot || status !== "live" || !canMatchLocally()) return
    const controller = new AbortController()
    const began = performance.now()
    let previous: Crop | null = null
    let misses = 0
    let buzzed = false
    let nextLoad = 0
    const loop = async () => {
      while (!controller.signal.aborted) {
        const started = performance.now()
        // A matcher that failed to load or lost its graphics device is tried again, gently.
        if (!localMatcherReady() && canMatchLocally() && started >= nextLoad) {
          nextLoad = started + 15_000
          prepareLocalMatcher()?.catch(() => {})
        }
        const video = videoRef.current
        const archive = archiveRef.current
        if (
          video?.videoWidth &&
          archive &&
          localMatcherReady() &&
          document.visibilityState === "visible"
        ) {
          const photo = { width: video.videoWidth, height: video.videoHeight }
          // The placement is as old as the frame it was found in, not the answer.
          const sampled = performance.now()
          const found = await align(archive, video, photo, controller.signal, {
            server: false,
          }).catch(() => null)
          if (controller.signal.aborted) return
          if (found) {
            misses = 0
            const near =
              previous != null &&
              Math.hypot(
                found.crop.cx - previous.cx,
                found.crop.cy - previous.cy
              ) <
                found.crop.width * 0.05 &&
              Math.abs(found.crop.width / previous.width - 1) < 0.05
            previous = found.crop
            const steady = near && fits(found.crop, archive.aspect, photo)
            if (steady && !buzzed) {
              buzzed = true
              navigator.vibrate?.(10)
            }
            setLock({
              crop: found.crop,
              held: near,
              steady,
              at: sampled,
            })
          } else if (++misses >= 2) {
            previous = null
            setLock(null)
          }
        }
        // Gentler on the battery after the first minute.
        const pace = performance.now() - began > 60_000 ? 2000 : 700
        lockLife.current = pace * 1.5 + 1500
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(0, pace - (performance.now() - started)))
        )
      }
    }
    void loop()
    return () => {
      controller.abort()
      setLock(null)
    }
  }, [shot, status])

  // A placement that has gone stale leaves the screen too, so what is shown is what is shot.
  useEffect(() => {
    if (!lock) return
    const timer = setTimeout(
      () => setLock((current) => (current === lock ? null : current)),
      Math.max(0, lock.at + lockLife.current - performance.now())
    )
    return () => clearTimeout(timer)
  }, [lock])

  const onVideoSize = () => {
    const video = videoRef.current
    debug(`video size ${video?.videoWidth}x${video?.videoHeight}`)
    if (video?.videoWidth)
      setVideoSize({ width: video.videoWidth, height: video.videoHeight })
  }

  // Where the camera picture and the archive view sit on screen.
  let ghost: (Box & { rotation: number }) | null = null
  if (videoSize.width && stage.width) {
    const shown = fit(
      videoSize.height / videoSize.width,
      stage.width,
      stage.height
    )
    const view = {
      ...shown,
      left: (stage.width - shown.width) / 2,
      top: (stage.height - shown.height) / 2,
    }
    const scale = view.width / videoSize.width
    if (lock) {
      const width = lock.crop.width * scale
      ghost = {
        width,
        height: width * aspect,
        left: view.left + lock.crop.cx * scale - width / 2,
        top: view.top + lock.crop.cy * scale - (width * aspect) / 2,
        rotation: lock.crop.rotation,
      }
    } else {
      const target = fit(aspect, view.width, view.height, GHOST_FILL)
      ghost = {
        ...target,
        left: view.left + (view.width - target.width) / 2,
        top: view.top + (view.height - target.height) / 2,
        rotation: 0,
      }
    }
  }

  const turnSideways = aspect < 1 && stage.height > stage.width
  const holdUpright = aspect > 1 && stage.width > stage.height

  const capture = () => {
    const video = videoRef.current
    if (!video?.videoWidth || video.readyState < 2 || interrupted) return
    const lean = tiltRef.current
    const canvas = grabFrame(video)
    const photo = { width: canvas.width, height: canvas.height }
    // The shot starts where the old photograph sat on screen: where the matcher had just put it
    // and still shows it held, or else the resting guide, levelled. The review refines it from the full picture.
    const held = lock?.held ? lock.crop : null
    const target = fit(aspect, photo.width, photo.height, GHOST_FILL)
    const crop =
      held ??
      shrinkToFit(
        {
          cx: photo.width / 2,
          cy: photo.height / 2,
          width: target.width,
          rotation: lean == null ? 0 : -lean,
        },
        aspect,
        photo
      )
    attempt.current++
    stop()
    setShot({
      canvas,
      crop,
      locked: !!held,
      archive: archiveRef.current,
      takenAt: new Date(),
    })
  }

  if (shot) {
    return (
      <RephotoReview
        name={name}
        slug={slug}
        thenSrc={thenSrc}
        aspect={aspect}
        shot={shot}
        onRetake={() => {
          // iPhone frees canvas memory late; hand it back now.
          releaseCanvas(shot.canvas)
          setShot(null)
        }}
      />
    )
  }

  return (
    <div
      data-testid="rephoto-camera"
      className="fixed inset-0 z-[60] flex flex-col bg-black text-white landscape:flex-row"
    >
      <div
        ref={stageRef}
        data-testid="rephoto-stage"
        data-lock={
          lock
            ? lock.steady
              ? "steady"
              : lock.held
                ? "held"
                : "found"
            : "none"
        }
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden [-webkit-touch-callout:none]"
        onPointerDown={() => setPeek(true)}
        onPointerUp={() => setPeek(false)}
        onPointerCancel={() => setPeek(false)}
        onPointerLeave={() => setPeek(false)}
        onContextMenu={(event) => event.preventDefault()}
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
        {ghost && (
          <div
            data-testid="rephoto-frame"
            className="pointer-events-none absolute transition-[left,top,width,height,transform] duration-300 ease-out motion-reduce:transition-none"
            style={{
              left: ghost.left,
              top: ghost.top,
              width: ghost.width,
              height: ghost.height,
              transform: `rotate(${ghost.rotation}rad)`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thenSrc}
              alt=""
              aria-hidden
              draggable={false}
              data-testid="rephoto-ghost"
              className="size-full transition-opacity duration-150"
              style={{ opacity: peek ? 0 : GHOST_OPACITY }}
            />
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-x-6 top-1/2 mx-auto max-w-xs -translate-y-1/2 text-center">
            {error && (
              <p data-testid="rephoto-error" className="mb-5 text-base">
                {error}
              </p>
            )}
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => void start()}
              className="rounded-md bg-white px-5 py-2.5 text-sm font-medium text-black"
            >
              {error ? "Try again" : "Start camera"}
            </button>
          </div>
        )}

        {status === "live" && (turnSideways || holdUpright) && (
          <p
            data-testid="rephoto-hint"
            className="pointer-events-none absolute inset-x-0 top-[max(1.25rem,env(safe-area-inset-top))] flex items-center justify-center gap-2 text-sm text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]"
          >
            <Smartphone
              className={turnSideways ? "size-4 rotate-90" : "size-4"}
              aria-hidden
            />
            {turnSideways ? "Turn sideways" : "Hold upright"}
          </p>
        )}

        {debugText && (
          <pre className="pointer-events-none absolute inset-x-2 top-16 whitespace-pre-wrap break-all text-[10px] text-lime-300">
            {debugText}
          </pre>
        )}
        <Link
          href={`/${slug}`}
          aria-label="Close camera"
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-black/40"
        >
          <X className="size-5" aria-hidden />
        </Link>
      </div>

      <div className="flex shrink-0 items-center justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 landscape:px-[max(1rem,env(safe-area-inset-right))] landscape:py-4">
        <button
          type="button"
          data-testid="rephoto-shutter"
          aria-label="Take photo"
          disabled={status !== "live" || interrupted}
          onClick={capture}
          className={`grid size-[4.5rem] place-items-center rounded-full border-4 transition-[transform,border-color] duration-300 active:scale-95 disabled:opacity-40 ${
            lock?.steady ? "border-accent" : "border-white"
          }`}
        >
          <span className="size-14 rounded-full bg-white" />
        </button>
      </div>
    </div>
  )
}
