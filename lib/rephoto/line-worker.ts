import type { Crop } from "./crop"
import { checkLines, type Gray } from "./line-check"
import type { ReferenceLines } from "./reference-lines"

export type FrameRequest = { live: Gray; crop: Crop; recognized: boolean }
let reference: { archive: Gray; guide: ReferenceLines } | undefined
self.onmessage = (
  event: MessageEvent<FrameRequest | { archive: Gray; guide: ReferenceLines }>
) => {
  const packet = event.data
  if ("archive" in packet) {
    reference = packet
    return
  }
  if (reference)
    self.postMessage(
      checkLines(
        reference.guide,
        reference.archive,
        packet.live,
        packet.crop,
        packet.recognized
      )
    )
}
