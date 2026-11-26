import { expect, test } from "@playwright/test"

import {
  alignmentScore,
  checkLines,
  scoreUsable,
  type Gray,
} from "@/lib/rephoto/line-check"
import type { ReferenceLines } from "@/lib/rephoto/reference-lines"

// "Lined up" as a plain calculation: a made-up scene with a wall corner (dark left of x = 0.4)
// and a canopy edge (dark above y = 0.3 on the right), each traced by a reference line.
function scene(width: number, height: number, canopyShift = 0): Gray {
  const data = new Float32Array(width * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const u = x / width
      const v = y / height
      data[y * width + x] =
        (u < 0.4 ? 0.2 : v < 0.3 + canopyShift ? 0.45 : 0.85) +
        (v > 0.75 ? (u < 0.5 ? 0.4 : -0.3) : 0)
    }
  return { width, height, data }
}
const guide: ReferenceLines = {
  image: "",
  features: [
    {
      name: "Wall corner",
      corner: "upper-left",
      region: "wall",
      points: [
        [0.4, 0.1],
        [0.4, 0.45],
      ],
    },
    {
      name: "Canopy underside",
      corner: "upper-right",
      region: "canopy",
      points: [
        [0.45, 0.3],
        [0.95, 0.3],
      ],
    },
    {
      name: "Mural detail",
      points: [
        [0.05, 0.5],
        [0.3, 0.5],
      ],
    },
    {
      name: "Left plinth",
      corner: "lower-left",
      region: "wall",
      points: [
        [0.08, 0.75],
        [0.32, 0.75],
      ],
    },
    {
      name: "Right plinth",
      corner: "lower-right",
      region: "canopy",
      points: [
        [0.58, 0.75],
        [0.92, 0.75],
      ],
    },
  ],
}
const crop = { cx: 240, cy: 160, width: 480, rotation: 0 }

test("every region on its edge: lined up", () => {
  const result = checkLines(guide, scene(480, 320), scene(480, 320), crop)
  expect(result.lines.map((line) => line.state)).toEqual([
    "on",
    "on",
    "unknown",
    "on",
    "on",
  ])
  expect(result.ok).toBe(true)

  // A visual-only guide can trace even a perfect match without awarding a score.
  const visualGuide: ReferenceLines = {
    ...guide,
    features: guide.features.map(({ name, points }) => ({ name, points })),
  }
  const manual = checkLines(visualGuide, scene(480, 320), scene(480, 320), crop)
  expect(manual.ok).toBe(false)
  expect(alignmentScore(manual, visualGuide)).toBeNull()
})

test("a canopy off its edge while the wall fits: not lined up, canopy named", () => {
  const result = checkLines(guide, scene(480, 320), scene(480, 320, 0.05), crop)
  expect(result.lines[0].state).toBe("on")
  expect(result.lines[1].state).toBe("off")
  expect(result.ok).toBe(false)
  expect(result.worst).toBe(1)
})

test("a canopy that can't be seen is never vouched for", () => {
  const blank: Gray = scene(480, 320)
  const live = scene(480, 320)
  // Only the lower-right corner disappears. Both structural regions still
  // have a perfect match elsewhere, as they did in the missed field frame.
  for (let y = 195; y < 320; y++)
    for (let x = 250; x < 480; x++) live.data[y * 480 + x] = 0.85
  const partial = checkLines(guide, blank, live, crop)
  expect(partial.lines[1].state).toBe("on")
  expect(partial.lines[4].state).toBe("unknown")
  expect(partial.ok).toBe(false)
  expect(scoreUsable(alignmentScore(partial, guide))).toBe(false)
  // Flatten the right half: no canopy edge to find.
  for (let y = 0; y < 320; y++)
    for (let x = 220; x < 480; x++) live.data[y * 480 + x] = 0.85
  const result = checkLines(guide, blank, live, crop)
  expect(result.lines[1].state).toBe("unknown")
  expect(result.ok).toBe(false)
})
