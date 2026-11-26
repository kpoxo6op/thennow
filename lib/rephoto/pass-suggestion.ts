import type { Gray, LineCheck } from "./line-check"
import { corroborated } from "./line-feedback"
import { grayOf, loadImage } from "./pixels"
import type { ReferenceLines } from "./reference-lines"

// All comparisons use a decoded moment of the finished clip and exact archive
// coordinates. Returning null leaves the entire pass available for manual pick.
export async function suggestMoment(
  url: string,
  seconds: number,
  aspect: number,
  guide: ReferenceLines,
  signal: AbortSignal
) {
  const player = document.createElement("video")
  player.muted = true
  player.playsInline = true
  const worker = new Worker(new URL("./line-worker.ts", import.meta.url), {
    type: "module",
  })
  const wait = (target: EventTarget, type: string, start: () => void) =>
    new Promise<Event>((resolve, reject) => {
      signal.throwIfAborted()
      const cleanup = () => {
        target.removeEventListener(type, ready)
        target.removeEventListener("error", fail)
        signal.removeEventListener("abort", fail)
        clearTimeout(timer)
      }
      const ready = (e: Event) => {
        cleanup()
        resolve(e)
      }
      const fail = () => {
        cleanup()
        reject(new Error("Frame analysis unavailable"))
      }
      const timer = setTimeout(fail, 1800)
      target.addEventListener(type, ready)
      target.addEventListener("error", fail)
      signal.addEventListener("abort", fail, { once: true })
      try {
        start()
      } catch {
        fail()
      }
    })
  try {
    await wait(player, "loadeddata", () => {
      player.src = url
      player.load()
    })
    const width = 256,
      height = Math.round(width * aspect)
    const archive = await grayOf(await loadImage(guide.image), width, height)
    if (!archive) return null
    worker.postMessage({ archive, guide })
    const duration = Math.min(
      seconds,
      Number.isFinite(player.duration) ? player.duration : seconds
    )
    let best: { time: number; on: number; sharp: number } | null = null
    const stopAt = performance.now() + 6000
    // Visit the middle, then both halves and their subdivisions, so a slower
    // phone samples the whole pass before spending time refining one moment.
    const times: number[] = []
    for (
      let slices = 1;
      duration / slices >= 0.35 || slices === 1;
      slices *= 2
    ) {
      for (let i = 0; i < slices; i++)
        times.push(((i + 0.5) * duration) / slices)
    }
    const coarse = times.length
    for (
      let i = 0;
      (i < times.length || (i === coarse && best)) &&
      performance.now() < stopAt;
      i++
    ) {
      if (i === coarse && best) {
        const step = duration / (coarse + 1)
        times.push(
          Math.max(0.001, best.time - step / 2),
          Math.min(duration - 0.001, best.time + step / 2)
        )
      }
      const time = times[i]
      await wait(player, "seeked", () => {
        player.currentTime = time
      })
      if (Math.abs(player.currentTime - time) > 0.12) continue
      const live = await grayOf(player, width, height)
      if (!live) continue
      const sharp = sharpness(live)
      const event = await wait(worker, "message", () =>
        worker.postMessage(
          {
            live,
            crop: { cx: width / 2, cy: height / 2, width, rotation: 0 },
            recognized: false,
          },
          [live.data.buffer]
        )
      )
      const check = (event as MessageEvent<LineCheck>).data
      if (!corroborated(check, guide, aspect)) continue
      const on = check.lines.filter(
        (l) =>
          l.distinctive && l.state === "on" && guide.features[l.index].corner
      ).length
      if (on < 2 || check.lines.some((l) => l.distinctive && l.state === "off"))
        continue
      if (!best || on > best.on || (on === best.on && sharp > best.sharp))
        best = { time, on, sharp }
    }
    return best?.time ?? null
  } finally {
    worker.terminate()
    player.removeAttribute("src")
    player.load()
  }
}
function sharpness({ width, height, data }: Gray) {
  let sum = 0
  for (let y = 1; y < height - 1; y += 2)
    for (let x = 1; x < width - 1; x += 2) {
      const i = y * width + x
      sum += Math.abs(
        4 * data[i] -
          data[i - 1] -
          data[i + 1] -
          data[i - width] -
          data[i + width]
      )
    }
  return sum
}
