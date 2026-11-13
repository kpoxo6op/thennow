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
  const slack = photo.width * 0.01
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
export function cueFor(e: CueErrors, showing: CueKind | null = null): Cue {
  const keep = (kind: CueKind) => (showing === kind ? 0.5 : 1)
  // Too big to fit even when centred: only stepping back (or a wider lens) helps.
  if (e.scale > 1.08 / keep("back") || (e.scale > 1.04 && !e.fits))
    return { kind: "back", amount: Math.min(1, (e.scale - 1) * 3) }
  const roll = Math.abs(e.roll)
  if (roll > CUE_LIMITS.roll * keep(e.roll > 0 ? "clockwise" : "anticlockwise"))
    return {
      kind: e.roll > 0 ? "clockwise" : "anticlockwise",
      amount: Math.min(1, roll / (15 * DEG)),
    }
  const ax = Math.abs(e.x)
  const ay = Math.abs(e.y)
  const horizontal = e.x > 0 ? "right" : "left"
  const vertical = e.y > 0 ? "down" : "up"
  const aimX = ax > CUE_LIMITS.aim * keep(horizontal)
  const aimY = ay > CUE_LIMITS.aim * keep(vertical)
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
  if (e.scale < CUE_LIMITS.smallest / (showing === "closer" ? 0.94 : 1))
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
