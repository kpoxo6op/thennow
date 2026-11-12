import { fits } from "./crop"
import {
  assessPreparedHandheld,
  prepareHandheldPhoto,
  prepareHandheldReference,
  type HandheldReference,
} from "./handheld"
import type { HandheldJob, HandheldReply } from "./handheld-client"

let reference: HandheldReference | null = null

self.onmessage = (event: MessageEvent<HandheldJob>) => {
  const job = event.data
  try {
    if (job.kind === "prepare") {
      reference = prepareHandheldReference(job.archive, job.guide)
      self.postMessage({ id: job.id, kind: "ready" } satisfies HandheldReply)
      return
    }
    if (!reference) throw new Error("Reference unavailable")
    const photo = prepareHandheldPhoto(job.photo)
    const assess = (crop: typeof job.seed) => {
      const result = assessPreparedHandheld(reference!, photo, crop)
      if (
        result.state === "adjusted" &&
        (!result.crop ||
          !fits(result.crop, job.aspect, job.photo) ||
          result.crop.width < job.photo.width * 0.55 ||
          Math.abs(result.crop.rotation) > Math.PI / 12)
      )
        return {
          ...result,
          state: "searching" as const,
          crop: null,
          reason: "outside_local_search",
        }
      return result
    }
    let assessment = assess(job.seed)
    // A rejected coarse placement, including a regional conflict, must not hide
    // a separately supported fixed target. Preserve conflict if neither passes.
    if (assessment.state !== "adjusted") {
      const target = assess(job.target)
      if (target.state === "adjusted" || assessment.state === "searching")
        assessment = target
    }
    let sum = 0
    const { width, height, data } = job.photo
    for (let y = 2; y < height - 2; y += 2)
      for (let x = 2; x < width - 2; x += 2) {
        const i = (y * width + x) * 4
        sum += Math.abs(
          4 * data[i] -
            data[i - 4] -
            data[i + 4] -
            data[i - width * 4] -
            data[i + width * 4]
        )
      }
    self.postMessage({
      id: job.id,
      kind: "result",
      assessment,
      sharpness: sum / (width * height),
    } satisfies HandheldReply)
  } catch {
    self.postMessage({ id: job.id, kind: "error" } satisfies HandheldReply)
  }
}
