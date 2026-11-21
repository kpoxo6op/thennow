import type { Crop, Size } from "@/lib/rephoto/crop"

// One small sign telling the person how to move the phone, worked out from where the matcher
// (and the follower between matches) puts the old photograph's view in the live picture.
//
// `crop` is that view in the live picture's pixels; `target` is where it should sit: centred,
// filling the frame as the shot will. The camera points at the middle of the picture, so a view
// to the right of the target means turning the phone right, one that is too big means stepping
// back, and one that leans clockwise means turning the phone clockwise.
//
// Sideways steps and stepping versus zooming can't be told apart from one rotation, zoom and
// shift; the sign says "closer" and "back" because this camera's zoom stays fixed.

export type CueKind =
  | "left"
  | "right"
  | "up"
  | "down"
  | "closer"
  | "back"
  | "clockwise"
  | "anticlockwise"
  | "step-left"
  | "step-right"
  | "raise"
  | "lower"
  | "hold"

export type Cue = { kind: CueKind; amount: number }

const DEG = Math.PI / 180

// Thresholds for entering an instruction, as fractions of the target's width (or radians). An
// instruction showing stays until its error falls below half of these, so the sign doesn't
// flicker on the boundary.
export const CUE_LIMITS = {
  aim: 0.05,
  roll: 4 * DEG,
  // The view may be this much smaller than the target: the crop zooms in digitally.
  smallest: 0.72,
}

function inside(crop: Crop, aspect: number, photo: Size) {
  const cos = Math.cos(crop.rotation)
  const sin = Math.sin(crop.rotation)
  const hw = crop.width / 2
  const hh = (crop.width * aspect) / 2
  // The same as the shot's own test (crop.ts fits): "hold" only for a framing the shot can keep.
  const slack = 0.5
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].every(([x, y]) => {
    const px = crop.cx + cos * x - sin * y
    const py = crop.cy + sin * x + cos * y
    return (
      px >= -slack &&
      py >= -slack &&
      px <= photo.width + slack &&
      py <= photo.height + slack
    )
  })
}

export type CueErrors = {
  x: number
  y: number
  scale: number
  roll: number
  fits: boolean
}

export function cueErrors(
  crop: Crop,
  target: Crop,
  aspect: number,
  photo: Size
): CueErrors {
  return {
    x: (crop.cx - target.cx) / target.width,
    y: (crop.cy - target.cy) / target.width,
    scale: crop.width / target.width,
    roll: crop.rotation - target.rotation,
    fits: inside(crop, aspect, photo),
  }
}

// The instruction for these errors, given the one showing now (for hysteresis).
// Where to stand, from parallax (lib/rephoto/parallax.ts): how far the near part of the view is off
// once the far part is lined up, as fractions of the view's width, and its relative size.
export type StepErrors = { sideways: number; height: number; depth: number }
// Parallax of this much (about 35 cm at Bradley Lane, above the measure's own noise) starts a\n// step; half of it ends one.
export const STEP_LIMIT = 0.03

export function cueFor(
  e: CueErrors,
  showing: CueKind | null = null,
  step: StepErrors | null = null,
  // False when the live picture is already shifted and turned onto the guide (places with
  // lines): then pointing only matters once the view no longer fits, and where you stand comes
  // first.
  aimMatters = true
): Cue {
  const keep = (kind: CueKind) => (showing === kind ? 0.5 : 1)
  // Too big to fit even when centred: only stepping back (or a wider lens) helps.
  if (e.scale > 1.08 / keep("back") || (e.scale > 1.04 && !e.fits))
    return { kind: "back", amount: Math.min(1, (e.scale - 1) * 3) }
  const aiming = aimMatters || !e.fits
  const roll = aiming ? Math.abs(e.roll) : 0
  if (roll > CUE_LIMITS.roll * keep(e.roll > 0 ? "clockwise" : "anticlockwise"))
    return {
      kind: e.roll > 0 ? "clockwise" : "anticlockwise",
      amount: Math.min(1, roll / (15 * DEG)),
    }
  const ax = Math.abs(e.x)
  const ay = Math.abs(e.y)
  const horizontal = e.x > 0 ? "right" : "left"
  const vertical = e.y > 0 ? "down" : "up"
  const aimX = aiming && ax > CUE_LIMITS.aim * keep(horizontal)
  const aimY = aiming && ay > CUE_LIMITS.aim * keep(vertical)
  if (aimX || aimY) {
    // The larger error first; a showing direction keeps its place unless clearly beaten.
    const preferX =
      aimX &&
      (!aimY ||
        ax * (showing === horizontal ? 1.5 : 1) >=
          ay * (showing === vertical ? 1.5 : 1))
    const value = preferX ? ax : ay
    return {
      kind: preferX ? horizontal : vertical,
      amount: Math.min(1, value / 0.4),
    }
  }
  if (step) {
    // Turning can't fix these: they need the person to move. Near things shifted left mean
    // standing too far right; shifted down, holding the phone too high; too big, too close.
    const options: { kind: CueKind; value: number }[] = [
      {
        kind: step.sideways < 0 ? "step-left" : "step-right",
        value: Math.abs(step.sideways),
      },
      {
        kind: step.height > 0 ? "lower" : "raise",
        value: Math.abs(step.height),
      },
      // Relative size is the noisiest measure: at Bradley Lane it read 3-12% from one spot, and
      // 4% on a shot whose lines all sat on their edges (16 Nov 2026). It needs 12% to ask for a step.
      {
        kind: step.depth > 0 ? "back" : "closer",
        value: Math.abs(step.depth) / 4,
      },
    ]
    const pick = options
      .filter((o) => o.value > STEP_LIMIT * (showing === o.kind ? 0.5 : 1))
      .sort(
        (a, b) =>
          b.value * (showing === b.kind ? 1.5 : 1) -
          a.value * (showing === a.kind ? 1.5 : 1)
      )[0]
    if (pick) return { kind: pick.kind, amount: Math.min(1, pick.value / 0.1) }
  } else if (e.scale < CUE_LIMITS.smallest / (showing === "closer" ? 0.94 : 1))
    return { kind: "closer", amount: Math.min(1, (1 - e.scale) * 2) }
  // Close: the crop can take the rest, provided it stays inside the picture.
  if (!e.fits)
    return ax >= ay
      ? { kind: horizontal, amount: 0.1 }
      : { kind: vertical, amount: 0.1 }
  return { kind: "hold", amount: 0 }
}

// Settles the instruction over time: a new one must be seen twice running (one follower step,
// about a quarter of a second) and an instruction stays at least `dwell` ms, unless the new one
// is "hold", which shows at once.
export class CueFilter {
  private shown: Cue | null = null
  private shownAt = 0
  private pending: CueKind | null = null
  private dwell: number
  constructor(dwell = 500) {
    this.dwell = dwell
  }
  get current() {
    return this.shown
  }
  update(next: Cue | null, now: number): Cue | null {
    if (!next) {
      this.shown = null
      this.pending = null
      return null
    }
    if (this.shown?.kind === next.kind) {
      this.shown = next
      this.pending = null
      return next
    }
    const confirmed = this.pending === next.kind || !this.shown
    this.pending = next.kind
    if (
      confirmed &&
      (next.kind === "hold" || now - this.shownAt >= this.dwell || !this.shown)
    ) {
      this.shown = next
      this.shownAt = now
      this.pending = null
    }
    return this.shown
  }
  reset() {
    this.shown = null
    this.pending = null
  }
}
