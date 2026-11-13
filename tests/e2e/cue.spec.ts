import { expect, test } from "@playwright/test"

import { cueErrors, CueFilter, cueFor } from "@/lib/rephoto/cue"

// The live sign, as plain calculations: where the old photograph's view sits in a 4032 x 3024
// picture, and which way the person has to move to bring it onto the target.
const photo = { width: 4032, height: 3024 }
const aspect = 2 / 3
const target = { cx: 2016, cy: 1512, width: 3628.8, rotation: 0 }
const sign = (crop: Partial<typeof target>, showing = null) =>
  cueFor(cueErrors({ ...target, ...crop }, target, aspect, photo), showing).kind

test("the view off to one side means turning the phone that way", () => {
  expect(sign({ cx: 2016 + 400, width: 3000 })).toBe("right")
  expect(sign({ cx: 2016 - 400, width: 3000 })).toBe("left")
  expect(sign({ cy: 1512 + 400, width: 3000 })).toBe("down")
  expect(sign({ cy: 1512 - 400, width: 3000 })).toBe("up")
})

test("too big means stepping back, too small stepping closer", () => {
  expect(sign({ width: 4400 })).toBe("back")
  expect(sign({ width: 2000 })).toBe("closer")
  // Somewhat smaller than the target is fine: the crop zooms in.
  expect(sign({ width: 3000 })).toBe("hold")
})

test("a view leaning clockwise means turning the phone clockwise", () => {
  expect(sign({ rotation: 0.15, width: 3000 })).toBe("clockwise")
  expect(sign({ rotation: -0.15, width: 3000 })).toBe("anticlockwise")
  expect(sign({ rotation: 0.03, width: 3000 })).toBe("hold")
})

test("a showing sign stays until well past its threshold", () => {
  // 4% off: not enough to start a sign, but enough to keep one already showing.
  expect(sign({ cx: 2016 + 0.04 * 3628.8, width: 3000 })).toBe("hold")
  expect(
    cueFor(
      cueErrors(
        { ...target, cx: 2016 + 0.04 * 3628.8, width: 3000 },
        target,
        aspect,
        photo
      ),
      "right"
    ).kind
  ).toBe("right")
})

test("a new sign must be seen twice and the old one stays a moment", () => {
  const filter = new CueFilter(500)
  expect(filter.update({ kind: "left", amount: 0.5 }, 0)?.kind).toBe("left")
  expect(filter.update({ kind: "up", amount: 0.5 }, 100)?.kind).toBe("left")
  expect(filter.update({ kind: "up", amount: 0.5 }, 200)?.kind).toBe("left")
  expect(filter.update({ kind: "up", amount: 0.5 }, 600)?.kind).toBe("up")
  // Lined up shows on the second sighting, without waiting out the dwell.
  expect(filter.update({ kind: "hold", amount: 0 }, 650)?.kind).toBe("up")
  expect(filter.update({ kind: "hold", amount: 0 }, 700)?.kind).toBe("hold")
  expect(filter.update(null, 750)).toBeNull()
})
