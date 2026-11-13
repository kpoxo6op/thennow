"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react"

import {
  align,
  NEAR_REACH,
  prepareArchive,
  type AlignDiagnostic,
  type Archive,
} from "@/lib/rephoto/align"
import {
  fits,
  releaseCanvas,
  shrinkToFit,
  type Crop,
  type Size,
} from "@/lib/rephoto/crop"
import {
  cueErrors,
  CueFilter,
  cueFor,
  type Cue,
  type CueKind,
} from "@/lib/rephoto/cue"
import {
  canMatchLocally,
  localMatcherReady,
  prepareLocalMatcher,
  saveData,
} from "@/lib/rephoto/local-matcher"
import { loadImage } from "@/lib/rephoto/pixels"
import {
  referenceLines,
  TRACE_OVERLAY_OPACITY,
} from "@/lib/rephoto/reference-lines"
import {
  beginCameraRun,
  browserName,
  diagnostic,
  flushTelemetry,
  report,
  startCameraSession,
} from "@/lib/rephoto/telemetry"
import { screenAngle, tiltFromGravity } from "@/lib/rephoto/tilt"
import { slide, thumb, type Thumb } from "@/lib/rephoto/track"
import { releaseScreen } from "@/components/rephoto/camera-link"
import { LiveDivider } from "@/components/rephoto/live-divider"
import { MatcherGuide } from "@/components/rephoto/matcher-guide"
import { ReferenceTrace } from "@/components/rephoto/reference-trace"
import { RephotoReview, type Shot } from "@/components/rephoto/rephoto-review"

const CUE_TEXT: Record<CueKind, string> = {
  left: "Turn left",
  right: "Turn right",
  up: "Tilt up",
  down: "Tilt down",
  closer: "Step closer",
  back: "Step back",
  clockwise: "Turn the phone clockwise",
  anticlockwise: "Turn the phone anticlockwise",
  hold: "Hold still",
}
function cueText(kind: CueKind, snapped: boolean) {
  return kind === "hold" && snapped
    ? "Lined up · Take the photo"
    : CUE_TEXT[kind]
}
const CUE_ICON = {
  left: ArrowLeft,
  right: ArrowRight,
  up: ArrowUp,
  down: ArrowDown,
  closer: ZoomIn,
  back: ZoomOut,
  clockwise: RotateCw,
  anticlockwise: RotateCcw,
  hold: Check,
}
function cueIcon(kind: CueKind) {
  const Icon = CUE_ICON[kind]
  return (
    <Icon
      data-testid="cue-icon"
      aria-hidden
      className={`size-5 shrink-0 ${kind === "hold" ? "text-lime-300" : "motion-safe:animate-pulse"}`}
    />
  )
}

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

const pageHidden = () => document.visibilityState === "hidden"

const stopStream = (stream: MediaStream) =>
  stream.getTracks().forEach((track) => track.stop())

// ?debug on the camera page lists each step of opening the camera, for phones without devtools.
// How often the follower looks; the ghost glides for as long between looks.
const FOLLOW_MS = 250
// Matched spots that make a single match trustworthy enough to steer by. Unrelated pictures reach
// about 10, and the shop fronts at Bradley Lane 150 to 350.
const STRONG_INLIERS = 40
// How long a match may be carried by the follower before a fresh match must confirm it.
const TRACKED_LIFE = 6000
// Width of the copy of the live picture the matcher looks at.
const SAMPLE_WIDTH = 1280

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
      const settings = track?.getSettings()
      report("stream", {
        ask: all.indexOf(constraints),
        allowed,
        width: settings?.width ?? null,
        height: settings?.height ?? null,
        fps: settings?.frameRate ?? null,
      })
      return stream
    } catch (error) {
      debug(`failed ${String(error)}`)
      report(
        "stream failed",
        { ask: all.indexOf(constraints), message: String(error).slice(0, 200) },
        { error: error instanceof DOMException ? error.name : "other" }
      )
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
  const trace = referenceLines(slug, thenSrc)
  const [aspect, setAspect] = useState(listedAspect)
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const archiveRef = useRef<Archive | null>(null)
  const tiltRef = useRef<number | null>(null)
  // How long the latest live placement stays good for: one round of matching and a bit more.
  const lockLife = useRef(2500)
  const attempt = useRef(0)
  const telemetryRun = useRef(0)
  const telemetry = useRef({
    state: trace ? "tracing" : "searching",
    runs: 0,
    found: 0,
    rejected: 0,
    lost: 0,
    firstFound: -1,
    firstSteady: -1,
    inFlightAt: 0,
    frameAt: 0,
  })
  const plain = useRef(false)
  // Report the camera's actual zoom; the guide never changes it.
  const zoomRef = useRef(1)
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
  const [showArchive, setShowArchive] = useState(false)
  const [reveal, setReveal] = useState(50)
  // Debounce drag/resize updates; no per-frame or per-pointer log stream.
  useEffect(() => {
    if (shot || status !== "live") return
    const record = () => {
      diagnostic("guide view", {
        view: trace ? (showArchive ? "archive" : "traces") : "split",
        overlay: trace ? (showArchive ? 1 : TRACE_OVERLAY_OPACITY) : 1,
        reveal: trace ? 100 : Math.round(reveal),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      })
    }
    if (trace) {
      record()
      return
    }
    const timer = setTimeout(record, 300)
    return () => clearTimeout(timer)
  }, [shot, status, trace, showArchive, reveal, stage.width, stage.height])
  const capturing = useRef(false)
  const [captureBusy, setCaptureBusy] = useState(false)
  // Where the archive view sits in the live picture, once the matcher has found it.
  const [lock, setLock] = useState<{
    crop: Crop
    // Found twice running in the same place.
    held: boolean
    // Temporally stable; this is not a photographic accuracy measurement.
    steady: boolean
    at: number
    // Carried along by the follower between matches: the ghost moves in short, even steps.
    followed?: boolean
    motion?: number
    trackedAt?: number
    confirmedAt?: number
    settledAt?: number
  } | null>(null)

  // A lost match fades at its last position instead of sweeping back to centre.
  const [lastPlacement, setLastPlacement] = useState<typeof lock>(null)
  if (lock && lastPlacement !== lock) setLastPlacement(lock)
  useEffect(() => {
    if (lock || !lastPlacement) return
    // Fade out where it was, then mount the resting reference without travelling
    // across the scene. Manual framing remains possible if matching never returns.
    const timer = setTimeout(() => setLastPlacement(null), 400)
    return () => clearTimeout(timer)
  }, [lock, lastPlacement])

  // One sign at a time telling which way to move, from where the view sits in the live picture.
  const cueFilter = useRef(new CueFilter())
  const [cue, setCue] = useState<Cue | null>(null)
  const cueLogged = useRef<{ kind: CueKind | "none"; at: number }>({
    kind: "none",
    at: 0,
  })
  useEffect(() => {
    const video = videoRef.current
    const now = performance.now()
    let next: Cue | null = null
    let errors: ReturnType<typeof cueErrors> | null = null
    if (lock && video?.videoWidth) {
      const photo = { width: video.videoWidth, height: video.videoHeight }
      const target = fit(aspect, photo.width, photo.height, GHOST_FILL)
      errors = cueErrors(
        lock.crop,
        {
          cx: photo.width / 2,
          cy: photo.height / 2,
          width: target.width,
          rotation: 0,
        },
        aspect,
        photo
      )
      next = cueFilter.current.update(
        cueFor(errors, cueFilter.current.current?.kind ?? null),
        now
      )
    } else cueFilter.current.update(null, now)
    setCue(next)
    const kind = next?.kind ?? "none"
    if (kind !== cueLogged.current.kind) {
      diagnostic("cue", {
        kind,
        x: errors?.x ?? null,
        y: errors?.y ?? null,
        scale: errors?.scale ?? null,
        roll: errors ? (errors.roll * 180) / Math.PI : null,
        snapped: kind === "hold" && !!lock?.held,
        age: cueLogged.current.at ? now - cueLogged.current.at : null,
      })
      cueLogged.current = { kind, at: now }
    }
  }, [lock, aspect])
  // Close enough: the crop does the rest, and the live picture snaps onto the old photograph.
  const snapped = !!lock?.held && cue?.kind === "hold"
  useEffect(() => {
    // Without lines the follower's own "steady" buzz already marks this.
    if (snapped && trace) navigator.vibrate?.(15)
  }, [snapped, trace])

  useEffect(() => {
    startCameraSession()
    diagnostic("experiment", {
      reference: Number(thenSrc.match(/^\/posts\/(\d{4})-/)?.[1] ?? -1),
      mode: trace ? "traces" : "split",
      overlay: trace ? TRACE_OVERLAY_OPACITY : 1,
      features: trace?.features.length ?? 0,
    })
    const loading = performance.now()
    const heartbeat = () => {
      const { inFlightAt, frameAt, ...counts } = telemetry.current
      diagnostic("heartbeat", {
        ...counts,
        seconds: Math.round((performance.now() - loading) / 1000),
        inFlightMs: inFlightAt ? performance.now() - inFlightAt : 0,
        frameAge: frameAt ? performance.now() - frameAt : null,
      })
    }
    const pulse = setInterval(heartbeat, 5000)
    report(
      "open",
      {
        screen: `${screen.width}x${screen.height}`,
        gpu: "gpu" in navigator,
        saveData: saveData(),
      },
      {
        browser: browserName(),
        matcher: canMatchLocally() ? "phone" : "server",
      }
    )
    prepareLocalMatcher()
      ?.then(() => {
        debug("matcher ready")
        report("matcher ready", {
          ms: Math.round(performance.now() - loading),
        })
      })
      .catch((error) =>
        report(
          "matcher failed",
          { message: String(error).slice(0, 200) },
          { ms: Math.round(performance.now() - loading) }
        )
      )
    // Leaving the camera hands the shot's memory and the screen back.
    return () => {
      clearInterval(pulse)
      heartbeat()
      diagnostic("session end", { reason: "unmount" })
      flushTelemetry()
      releaseScreen()
      if (shotRef.current) releaseCanvas(shotRef.current.canvas)
    }
  }, [trace, thenSrc])

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
    beginCameraRun(++telemetryRun.current)
    Object.assign(telemetry.current, {
      state: trace ? "tracing" : "searching",
      runs: 0,
      found: 0,
      rejected: 0,
      lost: 0,
      firstFound: -1,
      firstSteady: -1,
      inFlightAt: 0,
      frameAt: 0,
    })
    // Only the latest start keeps its camera; an older one that finishes late lets it go.
    const mine = ++attempt.current
    const asked = performance.now()
    stop()
    // Never open the camera behind the user's back: coming back into sight opens it.
    if (pageHidden()) return
    setStatus("starting")
    try {
      const stream = await openCamera(plain.current)
      const video = videoRef.current
      if (mine !== attempt.current || !video || pageHidden()) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const opened = stream.getVideoTracks()[0]
      zoomRef.current =
        (opened?.getSettings() as { zoom?: number } | undefined)?.zoom ?? 1
      video.srcObject = stream
      try {
        debug("play")
        await timeLimit(video.play(), 5000, () => {})
        debug(`playing ${video.videoWidth}x${video.videoHeight}`)
      } catch (error) {
        debug(`play failed ${String(error)} ready=${video.readyState}`)
        report("no picture", {
          message: String(error).slice(0, 200),
          ready: video.readyState,
          plain: plain.current,
        })
        // Some browsers only play after a tap; the button is that tap. A camera that never
        // started is asked for plainly next time; one that still gives no picture is stuck in
        // the browser (Firefox on Android after losing the camera), and only a restart frees it.
        const stuck = plain.current
        plain.current = true
        if (mine !== attempt.current) return
        stop()
        setError(
          stuck ? "Camera stuck. Close the browser fully and reopen." : ""
        )
        setStatus("error")
        return
      }
      if (mine !== attempt.current) return
      report(
        "live",
        { width: video.videoWidth, height: video.videoHeight },
        { ms: Math.round(performance.now() - asked) }
      )
      setStatus("live")
      setInterrupted(false)
      const track = stream.getVideoTracks()[0]
      // The screen locked, a call came in, another app took the camera.
      track?.addEventListener("ended", () => {
        if (mine !== attempt.current) return
        report("restart", {}, { reason: "ended" })
        setError("Camera paused.")
        setStatus("error")
      })
      track?.addEventListener("mute", () => {
        if (mine !== attempt.current) return
        setInterrupted(true)
        // A picture that stays stopped gets the camera opened again.
        setTimeout(() => {
          if (mine === attempt.current && track.muted) {
            report("restart", {}, { reason: "muted" })
            void restart.current()
          }
        }, 3000)
      })
      track?.addEventListener("unmute", () => {
        if (mine === attempt.current) setInterrupted(false)
      })
    } catch (caught) {
      plain.current = true
      if (mine !== attempt.current) return
      setError(explain(caught))
      report("camera error", {}, { message: explain(caught) })
      setStatus("error")
    }
  }, [stop, trace])
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
  // the camera) is noticed by its frames and the camera opened again. Only the live view is watched:
  // once a shot is taken the camera is meant to be closed.
  useEffect(() => {
    const video = videoRef.current as
      | (HTMLVideoElement & {
          requestVideoFrameCallback?: (callback: () => void) => number
          cancelVideoFrameCallback?: (handle: number) => void
        })
      | null
    if (shot || status !== "live" || !video?.requestVideoFrameCallback) return
    let last = performance.now()
    let handle = 0
    const onFrame = () => {
      last = performance.now()
      telemetry.current.frameAt = last
      handle = video.requestVideoFrameCallback!(onFrame)
    }
    handle = video.requestVideoFrameCallback(onFrame)
    const watch = setInterval(() => {
      if (document.visibilityState !== "visible") last = performance.now()
      else if (performance.now() - last > 3000) {
        debug("no frames")
        report("restart", {}, { reason: "no frames" })
        last = performance.now()
        void restart.current()
      }
    }, 1000)
    return () => {
      clearInterval(watch)
      video.cancelVideoFrameCallback?.(handle)
    }
  }, [shot, status])

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

  // Matching and following share immutable frames. Hardware zoom stays fixed: the review
  // crops the full photo without moving the view while someone is composing it.
  useEffect(() => {
    if (shot || status !== "live" || !canMatchLocally()) return
    const controller = new AbortController()
    const runSequence = telemetryRun
    const run = runSequence.current
    const counters = telemetry.current
    const began = performance.now()
    let reach = 1
    let misses = 0
    let buzzed = false
    const stats = {
      runs: 0,
      found: 0,
      rejected: 0,
      lost: 0,
      matchMs: 0,
      prepareMs: 0,
      modelMs: 0,
      firstFound: -1,
      firstSteady: -1,
    }
    type Placement = {
      crop: Crop
      photoSize: Size
      thumb: Thumb
      at: number
      trackedAt: number
      confirmedAt: number
      settledAt: number
      held: boolean
    }
    let anchor: Placement | null = null
    let candidate: {
      crop: Crop
      photoSize: Size
      thumb: Thumb
      at: number
    } | null = null
    let viewEpoch = 0
    const sameSize = (a: Size, b: Size) =>
      a.width === b.width && a.height === b.height
    const currentSize = (video: HTMLVideoElement, photo: Size) =>
      video.videoWidth === photo.width && video.videoHeight === photo.height
    let following = false
    let publishing = false
    const shifted = (
      crop: Crop,
      by: { x: number; y: number },
      photo: Size
    ) => ({
      ...crop,
      cx: crop.cx + by.x * photo.width,
      cy: crop.cy + by.y * photo.height,
    })
    const agrees = (a: Crop, b: Crop) =>
      Math.hypot(a.cx - b.cx, a.cy - b.cy) <
        Math.min(a.width, b.width) * 0.05 &&
      Math.abs(a.width / b.width - 1) < 0.05 &&
      Math.abs(a.rotation - b.rotation) < (3 * Math.PI) / 180
    const fresh = (at: number) =>
      performance.now() - at < Math.max(lockLife.current, TRACKED_LIFE)
    const guide = (
      state: string,
      reason: string,
      motion: number | null = null
    ) => {
      if (telemetry.current.state === state) return
      telemetry.current.state = state
      diagnostic("guide", {
        state,
        reason,
        motion,
        frameAge: anchor ? performance.now() - anchor.at : null,
        trackedAge: anchor ? performance.now() - anchor.trackedAt : null,
        confirmedAge: anchor?.confirmedAt
          ? performance.now() - anchor.confirmedAt
          : null,
      })
    }
    guide("searching", "first")
    const lose = (reason = "expired") => {
      if (anchor) stats.lost++
      guide("lost", reason)
      anchor = null
      setLock(null)
    }
    const invalidateView = (reason: string) => {
      viewEpoch++
      candidate = null
      lose(reason)
    }
    const onResize = () => invalidateView("resize")
    const onVisibility = () => {
      if (document.visibilityState !== "visible") invalidateView("hidden")
    }
    const liveVideo = videoRef.current
    document.addEventListener("visibilitychange", onVisibility)
    liveVideo?.addEventListener("resize", onResize)
    const follow = async () => {
      const video = videoRef.current
      const archive = archiveRef.current
      if (following || publishing || !anchor || !video?.videoWidth || !archive)
        return
      if (
        document.visibilityState !== "visible" ||
        !fresh(anchor.at) ||
        !currentSize(video, anchor.photoSize)
      ) {
        lose(
          document.visibilityState !== "visible"
            ? "hidden"
            : !currentSize(video, anchor.photoSize)
              ? "resize"
              : "expired"
        )
        return
      }
      following = true
      try {
        const from = anchor
        const photo = from.photoSize
        const epoch = viewEpoch
        const sampled = performance.now()
        const now = await thumb(video, photo)
        if (anchor !== from || publishing || controller.signal.aborted) return
        const measured = now && slide(from.thumb, now)
        // A turn or zoom the follower can't measure leaves the view where it was until the next
        // match, instead of wiping the sign; a long gap still lets it expire.
        const by = measured ?? { x: 0, y: 0 }
        if (
          !now ||
          !fresh(from.at) ||
          epoch !== viewEpoch ||
          !currentSize(video, photo) ||
          document.visibilityState !== "visible"
        ) {
          lose(
            !now
              ? "tracking-failed"
              : epoch !== viewEpoch
                ? "view-changed"
                : "expired"
          )
          return
        }
        const crop = shifted(from.crop, by, photo)
        const elapsed = sampled - from.trackedAt
        const motion =
          (Math.hypot(by.x, (by.y * photo.height) / photo.width) * 250) /
          Math.max(1, elapsed)
        const quiet = !!measured && elapsed <= 750 && motion <= 0.008
        const settledAt = quiet ? from.settledAt || sampled : 0
        const steady =
          from.held &&
          quiet &&
          settledAt > 0 &&
          sampled - settledAt >= 750 &&
          sampled - from.confirmedAt <= 4000 &&
          fits(crop, archive.aspect, photo)
        anchor = measured
          ? { ...from, crop, thumb: now, trackedAt: sampled, settledAt }
          : { ...from, settledAt: 0 }
        if (steady && !buzzed) {
          buzzed = true
          stats.firstSteady = Math.round(performance.now() - began)
          navigator.vibrate?.(10)
        }
        guide(
          steady ? "steady" : from.held ? "held" : "candidate",
          "agreement",
          motion
        )
        setLock({
          crop,
          held: from.held,
          steady,
          at: from.at,
          followed: true,
          motion,
          trackedAt: measured ? sampled : from.trackedAt,
          confirmedAt: from.confirmedAt,
          settledAt,
        })
      } finally {
        following = false
      }
    }
    const follower = setInterval(() => void follow(), FOLLOW_MS)
    const loop = async () => {
      while (!controller.signal.aborted) {
        const started = performance.now()
        if (!localMatcherReady() && canMatchLocally())
          prepareLocalMatcher()?.catch(() => {})
        const video = videoRef.current
        const archive = archiveRef.current
        if (
          video?.videoWidth &&
          archive &&
          localMatcherReady() &&
          document.visibilityState === "visible"
        ) {
          let photo = { width: video.videoWidth, height: video.videoHeight }
          const epoch = viewEpoch
          const sampled = performance.now()
          const sampledReach = reach
          let frame: ImageBitmap | null = null
          let seen: Thumb | null = null
          let found: Awaited<ReturnType<typeof align>> = null
          let measured: AlignDiagnostic = {
            reason: "prepare_error",
            backend: "none",
            prepareMs: 0,
            modelMs: 0,
          }
          let dx: number | null = null
          let dy: number | null = null
          let scaleDelta: number | null = null
          let rotationDelta: number | null = null
          let outcome = "miss"
          let reason: string = "frame-unavailable"
          telemetry.current.inFlightAt = sampled
          try {
            // A small copy, made off to the side: reading back the whole 12 MP picture took up
            // to a second on a Pixel (Bradley Lane, 14 Nov 2026), long enough to spoil each match.
            const scale = Math.min(1, SAMPLE_WIDTH / video.videoWidth)
            frame = await createImageBitmap(video, {
              resizeWidth: Math.round(video.videoWidth * scale),
              resizeHeight: Math.round(video.videoHeight * scale),
              resizeQuality: "medium",
            })
            const small = { width: frame.width, height: frame.height }
            if (epoch === viewEpoch && currentSize(video, photo))
              seen = await thumb(frame, photo)
            if (
              !controller.signal.aborted &&
              seen &&
              epoch === viewEpoch &&
              currentSize(video, photo)
            ) {
              const inSmall = await align(
                archive,
                frame,
                small,
                controller.signal,
                {
                  server: false,
                  reach,
                  // Part of the view in the picture is enough to say which way to move.
                  minCoverage: 0.3,
                  diagnostic: (details) => {
                    measured = details
                  },
                }
              )
              const up = photo.width / small.width
              found = inSmall && {
                ...inSmall,
                crop: {
                  cx: inSmall.crop.cx * up,
                  cy: (inSmall.crop.cy * photo.height) / small.height,
                  width: inSmall.crop.width * up,
                  rotation: inSmall.crop.rotation,
                },
              }
            }
          } catch {
            // A stopped stream or unavailable matcher is a miss, never a usable placement.
          } finally {
            frame?.close()
          }
          if (controller.signal.aborted) return
          telemetry.current.inFlightAt = 0
          reason = seen
            ? measured.reason
            : frame
              ? "thumbnail-unavailable"
              : "frame-unavailable"
          if (
            [
              "local_timeout",
              "local_inference_error",
              "server_timeout",
              "server_error",
              "prepare_error",
            ].includes(reason)
          )
            outcome = "error"
          stats.runs++
          stats.matchMs += performance.now() - sampled
          stats.prepareMs += measured.prepareMs
          stats.modelMs += measured.modelMs
          debug(
            `match ${Math.round(measured.prepareMs)}+${Math.round(measured.modelMs)}ms ${found ? `w${Math.round(found.crop.width)} n${found.inliers}` : "miss"}`
          )
          if (
            document.visibilityState !== "visible" ||
            epoch !== viewEpoch ||
            !currentSize(video, photo)
          ) {
            candidate = null
            outcome = "discarded"
            reason = "view-changed"
            lose(reason)
          } else if (found && seen && fresh(sampled)) {
            stats.found++
            if (stats.firstFound < 0)
              stats.firstFound = Math.round(performance.now() - began)
            misses = 0
            // Correct inference latency before publishing. Never show the sampled placement
            // first and then jump it forward when the follower catches up.
            publishing = true
            try {
              const nowAt = performance.now()
              const latest = await thumb(video, photo)
              if (controller.signal.aborted) return
              // The follower can't measure a turn or a zoom; then the match is shown where it
              // was found rather than thrown away (a moving hand never got a sign before).
              const drift = latest && (slide(seen, latest) ?? { x: 0, y: 0 })
              if (
                !latest ||
                !drift ||
                !fresh(sampled) ||
                epoch !== viewEpoch ||
                !currentSize(video, photo) ||
                document.visibilityState !== "visible"
              ) {
                candidate = null
                outcome = "discarded"
                reason =
                  !latest || !drift
                    ? "drift-failed"
                    : !fresh(sampled)
                      ? "stale-result"
                      : "view-changed"
                lose(reason)
              } else {
                const crop = shifted(found.crop, drift, photo)
                if (
                  anchor &&
                  (!fresh(anchor.at) || !sameSize(anchor.photoSize, photo))
                )
                  lose()
                if (candidate && !sameSize(candidate.photoSize, photo))
                  candidate = null
                const previous = anchor
                const movement = previous && slide(previous.thumb, latest)
                const predicted =
                  previous && movement
                    ? shifted(previous.crop, movement, photo)
                    : null
                if (predicted) {
                  dx = (crop.cx - predicted.cx) / photo.width
                  dy = (crop.cy - predicted.cy) / photo.height
                  scaleDelta = crop.width / predicted.width - 1
                  rotationDelta = crop.rotation - predicted.rotation
                }
                const near = predicted != null && agrees(crop, predicted)
                const pendingMovement =
                  candidate &&
                  fresh(candidate.at) &&
                  slide(candidate.thumb, latest)
                const repeated =
                  candidate &&
                  pendingMovement &&
                  agrees(crop, shifted(candidate.crop, pendingMovement, photo))
                // A strong match is shown at once (a sign, not a snap); a weak one waits for a
                // second that agrees.
                if (!near && !repeated && found.inliers < STRONG_INLIERS) {
                  if (previous) stats.rejected++
                  outcome = previous ? "rejected" : "candidate"
                  reason = previous ? "disagreement" : "first"
                  guide("candidate", reason)
                  // Retain the accepted position, but a disagreement cancels readiness now.
                  anchor = previous
                    ? {
                        ...previous,
                        held: false,
                        settledAt: 0,
                        confirmedAt: 0,
                      }
                    : null
                  setLock((current) =>
                    current
                      ? {
                          ...current,
                          held: false,
                          steady: false,
                          settledAt: 0,
                          confirmedAt: 0,
                        }
                      : null
                  )
                  candidate = {
                    crop,
                    photoSize: photo,
                    thumb: latest,
                    at: sampled,
                  }
                } else {
                  outcome = "accepted"
                  reason = "agreement"
                  const held = near || !!repeated
                  const completed = performance.now()
                  const elapsed = previous
                    ? nowAt - previous.trackedAt
                    : Infinity
                  const motion = movement
                    ? (Math.hypot(
                        movement.x,
                        (movement.y * photo.height) / photo.width
                      ) *
                        250) /
                      Math.max(1, elapsed)
                    : Infinity
                  const quiet = near && elapsed <= 750 && motion <= 0.008
                  const settledAt = quiet ? previous!.settledAt : 0
                  anchor = {
                    crop,
                    photoSize: photo,
                    thumb: latest,
                    at: sampled,
                    trackedAt: nowAt,
                    confirmedAt: held ? completed : 0,
                    settledAt,
                    held,
                  }
                  candidate = held
                    ? null
                    : { crop, photoSize: photo, thumb: latest, at: sampled }
                  // Preserve readiness only when nearby-frame following had already
                  // established stillness; an independent match alone cannot establish it.
                  const steady =
                    held &&
                    quiet &&
                    settledAt > 0 &&
                    nowAt - settledAt >= 750 &&
                    fits(crop, archive.aspect, photo)
                  guide(
                    steady ? "steady" : "held",
                    "agreement",
                    Number.isFinite(motion) ? motion : null
                  )
                  setLock({
                    crop,
                    held,
                    steady,
                    at: sampled,
                    trackedAt: nowAt,
                    motion,
                    confirmedAt: anchor.confirmedAt,
                    settledAt,
                  })
                }
              }
            } finally {
              publishing = false
            }
          } else {
            if (found && !fresh(sampled)) {
              outcome = "discarded"
              reason = "stale-result"
            }
            reach = reach < 1 ? 1 : NEAR_REACH
            candidate = null
            if (anchor) {
              anchor = { ...anchor, held: false, settledAt: 0, confirmedAt: 0 }
              setLock((current) =>
                current
                  ? {
                      ...current,
                      held: false,
                      steady: false,
                      settledAt: 0,
                      confirmedAt: 0,
                    }
                  : null
              )
            }
            if (anchor) guide("candidate", "misses")
            if (++misses >= 2) lose("misses")
          }
          Object.assign(telemetry.current, {
            runs: stats.runs,
            found: stats.found,
            rejected: stats.rejected,
            lost: stats.lost,
            firstFound: stats.firstFound,
            firstSteady: stats.firstSteady,
          })
          diagnostic("match result", {
            attempt: stats.runs,
            dx,
            dy,
            scaleDelta,
            rotationDelta,
            outcome,
            reason,
            backend: measured.backend,
            prepareMs: measured.prepareMs,
            modelMs: measured.modelMs,
            matchMs: performance.now() - sampled,
            rawMatches: measured.matches ?? null,
            inliers: measured.inliers ?? null,
            fallbackReason: measured.fallbackReason ?? null,
            frameAge: performance.now() - sampled,
            reach: sampledReach,
          })
        }
        const pace = performance.now() - began > 60_000 ? 2000 : 700
        const took = performance.now() - started
        const rest = Math.max(pace - took, Math.min(took / 2, 1500))
        lockLife.current = Math.max(pace * 1.5 + 1500, took * 2 + rest + 500)
        await new Promise((resolve) => setTimeout(resolve, rest))
      }
    }
    void loop()
    return () => {
      controller.abort()
      counters.inFlightAt = 0
      clearInterval(follower)
      document.removeEventListener("visibilitychange", onVisibility)
      liveVideo?.removeEventListener("resize", onResize)
      setLock(null)
      if (run !== runSequence.current) return
      report(
        "live matching",
        {
          runs: stats.runs,
          found: stats.found,
          rejected: stats.rejected,
          lost: stats.lost,
          matchMs: stats.runs ? Math.round(stats.matchMs / stats.runs) : null,
          prepareMs: stats.runs
            ? Math.round(stats.prepareMs / stats.runs)
            : null,
          modelMs: stats.runs ? Math.round(stats.modelMs / stats.runs) : null,
          firstFound: stats.firstFound,
          firstSteady: stats.firstSteady,
          seconds: Math.round((performance.now() - began) / 1000),
        },
        { steady: stats.firstSteady >= 0 }
      )
    }
  }, [shot, status, trace])

  // A placement that has gone stale leaves the screen too, so what is shown is what is shot.
  useEffect(() => {
    if (!lock) return
    const timer = setTimeout(
      () => setLock((current) => (current === lock ? null : current)),
      Math.max(
        0,
        lock.at + Math.max(lockLife.current, TRACKED_LIFE) - performance.now()
      )
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
  let view: Box | null = null
  if (videoSize.width && stage.width) {
    const shown = fit(
      videoSize.height / videoSize.width,
      stage.width,
      stage.height
    )
    view = {
      ...shown,
      left: (stage.width - shown.width) / 2,
      top: (stage.height - shown.height) / 2,
    }
    const scale = view.width / videoSize.width
    const placement = trace ? null : (lock ?? lastPlacement)
    if (placement) {
      const width = placement.crop.width * scale
      ghost = {
        width,
        height: width * aspect,
        left: view.left + placement.crop.cx * scale - width / 2,
        top: view.top + placement.crop.cy * scale - (width * aspect) / 2,
        rotation: placement.crop.rotation,
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

  const capture = async () => {
    const video = videoRef.current
    if (
      !video?.videoWidth ||
      video.readyState < 2 ||
      interrupted ||
      capturing.current ||
      document.visibilityState !== "visible"
    )
      return
    capturing.current = true
    setCaptureBusy(true)
    const lean = tiltRef.current
    const photo = { width: video.videoWidth, height: video.videoHeight }
    // The shot starts where the old photograph sat on screen: where the matcher had just put it
    // and still shows it held, or else the resting guide, levelled. The review refines it from the full picture.
    const now = performance.now()
    const held =
      lock?.held &&
      now - lock.at < Math.max(lockLife.current, TRACKED_LIFE) &&
      lock.trackedAt != null &&
      now - lock.trackedAt < 600 &&
      fits(lock.crop, aspect, photo)
        ? lock.crop
        : null
    const target = fit(aspect, photo.width, photo.height, GHOST_FILL)
    let crop =
      held ??
      shrinkToFit(
        {
          cx: photo.width / 2,
          cy: photo.height / 2,
          width: target.width,
          rotation: trace || lean == null ? 0 : -lean,
        },
        aspect,
        photo
      )
    const frameAge = telemetry.current.frameAt
      ? now - telemetry.current.frameAt
      : null
    const mediaTime = video.currentTime * 1000
    const canvas = grabFrame(video)
    report(
      "shot",
      {
        width: photo.width,
        height: photo.height,
        lean: lean == null ? null : Math.round((lean * 180) / Math.PI),
        zoom: zoomRef.current,
        steady: !!lock?.steady,
        cropX: crop.cx / photo.width,
        cropY: crop.cy / photo.height,
        cropWidth: crop.width / photo.width,
        cropRotation: crop.rotation,
        aspect,
        frameAge,
        mediaTime,
        reveal: trace ? 100 : Math.round(reveal),
        overlay: trace ? TRACE_OVERLAY_OPACITY : 1,
      },
      {
        framing: held
          ? trace
            ? "snapped"
            : "live"
          : trace
            ? "traced"
            : "levelled",
        how: "manual",
      }
    )
    attempt.current++
    stop()
    setShot({
      canvas,
      crop,
      locked: !!held,
      traced: !!trace,
      assisted: !!trace && !!held,
      assistanceLost: false,
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
          report("retake")
          capturing.current = false
          setCaptureBusy(false)
          setLastPlacement(null)
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
        onContextMenu={(event) => event.preventDefault()}
      >
        <video
          ref={videoRef}
          data-testid="rephoto-video"
          className="absolute inset-0 size-full object-contain"
          autoPlay
          muted
          playsInline
          style={
            trace && snapped && lock && ghost && view && !showArchive
              ? {
                  transform: `scale(${ghost.width / ((lock.crop.width * view.width) / videoSize.width)}) rotate(${-lock.crop.rotation}rad) translate(${((videoSize.width / 2 - lock.crop.cx) * view.width) / videoSize.width}px, ${((videoSize.height / 2 - lock.crop.cy) * view.width) / videoSize.width}px)`,
                  transition: "transform 250ms ease-out",
                }
              : undefined
          }
          onLoadedMetadata={onVideoSize}
          onResize={onVideoSize}
        />
        {ghost && view && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              clipPath: trace
                ? undefined
                : `inset(${view.top}px ${stage.width - view.left - (view.width * reveal) / 100}px ${stage.height - view.top - view.height}px ${view.left}px)`,
            }}
          >
            <div
              key={lock || lastPlacement ? "tracked" : "resting"}
              data-testid="rephoto-frame"
              className={`tn-enter pointer-events-none absolute transition-[left,top,width,height,transform] motion-reduce:transition-none ${
                // The follower's small steps run into each other; a new match's jump eases in.
                lock?.followed
                  ? "duration-[250ms] ease-linear"
                  : "duration-300 ease-out"
              }`}
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
                style={{
                  opacity: trace
                    ? showArchive
                      ? 1
                      : TRACE_OVERLAY_OPACITY
                    : !lock && lastPlacement
                      ? 0
                      : 1,
                }}
              />
              {trace && (
                <>
                  <div className="absolute inset-0 border border-white/35" />
                  <ReferenceTrace guide={trace} highlighted={null} />
                </>
              )}
            </div>
          </div>
        )}
        {!trace &&
          view &&
          status === "live" &&
          !interrupted &&
          !(!lock && lastPlacement) && (
            <div
              className="pointer-events-none absolute"
              style={{
                left: view.left,
                top: view.top,
                width: view.width,
                height: view.height,
              }}
            >
              <LiveDivider value={reveal} onChange={setReveal} />
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

        {trace ? (
          <>
            {status === "live" && !interrupted && (
              <div
                data-testid="handheld-guide"
                data-state={snapped ? "adjusted" : lock ? "found" : "searching"}
                data-cue={cue?.kind ?? "none"}
              >
                <MatcherGuide
                  hidden={false}
                  icon={captureBusy || !cue ? undefined : cueIcon(cue.kind)}
                  message={
                    captureBusy
                      ? "Taking photo…"
                      : cue
                        ? cueText(cue.kind, snapped)
                        : "Point at the view in the old photo"
                  }
                />
              </div>
            )}
            <button
              type="button"
              aria-pressed={showArchive}
              disabled={captureBusy}
              onClick={() => setShowArchive(!showArchive)}
              className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] min-h-11 rounded-full bg-black/65 px-3 text-sm"
            >
              {showArchive ? "Live camera" : "Old photo"}
            </button>
          </>
        ) : (
          <div data-cue={cue?.kind ?? "none"}>
            <MatcherGuide
              hidden={status !== "live" || interrupted}
              found={!!lock?.held}
              icon={cue ? cueIcon(cue.kind) : undefined}
              message={
                cue && cue.kind !== "hold"
                  ? cueText(cue.kind, false)
                  : undefined
              }
            />
          </div>
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
          disabled={
            status !== "live" ||
            interrupted ||
            captureBusy ||
            (!!trace && showArchive)
          }
          onClick={() => capture()}
          className="relative grid size-[4.5rem] place-items-center rounded-full border-4 border-white transition-transform duration-300 active:scale-95 disabled:opacity-40"
        >
          <span className="size-14 rounded-full bg-white" />
        </button>
      </div>
    </div>
  )
}
