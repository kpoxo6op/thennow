import type { Crop } from "./crop"
import type { HandheldAssessment } from "./handheld"
import type { ReferenceLines } from "./reference-lines"

export type HandheldJob =
  | { kind: "prepare"; id: number; archive: ImageData; guide: ReferenceLines }
  | {
      kind: "assess"
      id: number
      photo: ImageData
      seed: Crop
      target: Crop
      aspect: number
    }
export type HandheldReply =
  | { kind: "ready"; id: number }
  | { kind: "error"; id: number }
  | {
      kind: "result"
      id: number
      assessment: HandheldAssessment
      sharpness: number
    }

// One bounded job at a time. Capture can await the existing live job; no frame
// queue accumulates while a device is slow. A broken worker fails closed.
export class HandheldEvaluator {
  private worker = new Worker(new URL("./handheld-worker.ts", import.meta.url))
  private sequence = 0
  private pending: {
    id: number
    resolve: (reply: HandheldReply | null) => void
    timer: ReturnType<typeof setTimeout>
  } | null = null
  private stopped = false
  private current: Promise<HandheldReply | null> = Promise.resolve(null)

  constructor() {
    this.worker.onmessage = (event: MessageEvent<HandheldReply>) => {
      if (event.data.id !== this.pending?.id) return
      clearTimeout(this.pending.timer)
      this.pending.resolve(event.data.kind === "error" ? null : event.data)
      this.pending = null
    }
    this.worker.onerror = () => this.dispose()
  }
  private run(job: HandheldJob, transfer: Transferable[]) {
    if (this.stopped || this.pending) return Promise.resolve(null)
    this.current = new Promise<HandheldReply | null>((resolve) => {
      this.pending = {
        id: job.id,
        resolve,
        timer: setTimeout(
          () => this.dispose(),
          job.kind === "prepare" ? 10000 : 800
        ),
      }
      try {
        this.worker.postMessage(job, transfer)
      } catch {
        this.dispose()
      }
    })
    return this.current
  }
  async prepare(archive: ImageData, guide: ReferenceLines) {
    return (
      (
        await this.run(
          { kind: "prepare", id: ++this.sequence, archive, guide },
          [archive.data.buffer]
        )
      )?.kind === "ready"
    )
  }
  async idle() {
    await this.current
  }
  async assess(photo: ImageData, seed: Crop, target: Crop, aspect: number) {
    const reply = await this.run(
      { kind: "assess", id: ++this.sequence, photo, seed, target, aspect },
      [photo.data.buffer]
    )
    return reply?.kind === "result" ? reply : null
  }
  dispose() {
    this.stopped = true
    this.worker.terminate()
    if (this.pending) {
      clearTimeout(this.pending.timer)
      this.pending.resolve(null)
      this.pending = null
    }
  }
}
