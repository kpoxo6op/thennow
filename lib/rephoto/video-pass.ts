import { releaseCanvas, type Crop } from "./crop"

export const PASS_SECONDS = 12
const FPS = 20
export type VideoPass = {
  blob: Blob
  seconds: number
  started: number
  aspect: number
}

// Encode only the pixels inside the live guide. The camera owns the original
// track. Stopping this encoder must never turn off the still camera.
export function recordPass(
  video: HTMLVideoElement,
  currentCrop: () => Crop,
  aspect: number,
  done: (pass: VideoPass | null) => void
) {
  const width = video.videoWidth
  const height = video.videoHeight
  const canvas = document.createElement("canvas")
  const crop = currentCrop()
  const scale = Math.min(1, 1920 / Math.max(crop.width, crop.width * aspect))
  canvas.width = Math.max(2, 2 * Math.round((crop.width * scale) / 2))
  canvas.height = Math.max(2, 2 * Math.round((crop.width * aspect * scale) / 2))
  const context = canvas.getContext("2d", { alpha: false })
  if (!context) throw new Error("Video canvas unavailable")
  const draw = () => {
    const crop = currentCrop()
    context.drawImage(
      video,
      crop.cx - crop.width / 2,
      crop.cy - (crop.width * aspect) / 2,
      crop.width,
      crop.width * aspect,
      0,
      0,
      canvas.width,
      canvas.height
    )
  }
  draw()
  const stream = canvas.captureStream(FPS)
  let encoder: MediaRecorder | undefined
  let tick = 0
  let limit = 0
  let watchdog = 0
  let ended = false
  let stopping = false
  let seconds = 0
  let bytes = 0
  const chunks: Blob[] = []
  const clock = performance.now()
  const started = Date.now()
  const finish = (publish: boolean) => {
    if (ended) return
    ended = true
    clearInterval(tick)
    clearTimeout(limit)
    clearTimeout(watchdog)
    document.removeEventListener("visibilitychange", visibility)
    window.removeEventListener("pagehide", cancel)
    window.removeEventListener("orientationchange", cancel)
    video.removeEventListener("resize", sizeChanged)
    if (encoder && encoder.state !== "inactive") encoder.stop()
    for (const track of stream.getTracks()) track.stop()
    releaseCanvas(canvas)
    const blob =
      publish && bytes && seconds > 0
        ? new Blob(chunks, { type: encoder?.mimeType || chunks[0].type })
        : null
    chunks.length = 0
    done(blob ? { blob, seconds, started, aspect } : null)
  }
  const cancel = () => finish(false)
  const sizeChanged = () => {
    if (video.videoWidth !== width || video.videoHeight !== height) cancel()
  }
  const visibility = () => {
    if (document.hidden) cancel()
  }
  const stop = () => {
    if (ended || stopping) return
    stopping = true
    seconds = Math.min(PASS_SECONDS, (performance.now() - clock) / 1000)
    clearInterval(tick)
    clearTimeout(limit)
    watchdog = window.setTimeout(cancel, 3000)
    if (encoder?.state === "recording") encoder.stop()
    else cancel()
  }
  try {
    // A browser may advertise a codec its hardware cannot start at this size.
    for (const mimeType of [
      "video/mp4",
      "video/webm;codecs=vp8",
      "video/webm",
      "",
    ]) {
      if (mimeType && !MediaRecorder.isTypeSupported(mimeType)) continue
      try {
        encoder = new MediaRecorder(stream, {
          ...(mimeType && { mimeType }),
          videoBitsPerSecond: 7_000_000,
        })
        encoder.start(500)
        break
      } catch {
        encoder = undefined
      }
    }
    if (!encoder) throw new Error("No video encoder")
    encoder.ondataavailable = (e) => {
      if (ended || !e.data.size) return
      bytes += e.data.size
      if (bytes > 20_000_000) {
        cancel()
        return
      }
      chunks.push(e.data)
    }
    encoder.onerror = cancel
    encoder.onstop = () => finish(stopping)
    draw()
    let lastTime = video.currentTime
    tick = window.setInterval(() => {
      if (video.readyState < 2 || video.currentTime === lastTime) return
      lastTime = video.currentTime
      try {
        draw()
      } catch {
        cancel()
      }
    }, 1000 / FPS)
    limit = window.setTimeout(stop, PASS_SECONDS * 1000)
    document.addEventListener("visibilitychange", visibility)
    window.addEventListener("pagehide", cancel)
    window.addEventListener("orientationchange", cancel)
    video.addEventListener("resize", sizeChanged)
    return { stop, cancel }
  } catch {
    cancel()
    throw new Error("Video recording unavailable")
  }
}
