export const COMPARE_SIDE_GUTTER_PX = 40

// Share of slider travel, at each end, over which the line runs out to the
// photo's edge. Between the end zones the line stays exactly under the slider.
const END_ZONE_PERCENT = 5

// The slider's hit area stays inside the safe gutters, while the line has to
// reach the edges of the photo so that 0 and 100 show one photograph whole.
// The visible grip always sits on the line.
// Returns the line's place as a percentage of the slider range; beyond 0 or 100
// means it is out in a gutter. The overhangs are the gutters as the same share.
export function compareLinePercent(
  position: number,
  overhangLeft: number,
  overhangRight: number
) {
  const bounded = Math.min(100, Math.max(0, position))

  if (bounded < END_ZONE_PERCENT) {
    const progress = bounded / END_ZONE_PERCENT
    return -overhangLeft + progress * (END_ZONE_PERCENT + overhangLeft)
  }

  if (bounded > 100 - END_ZONE_PERCENT) {
    const progress = (100 - bounded) / END_ZONE_PERCENT
    return 100 + overhangRight - progress * (END_ZONE_PERCENT + overhangRight)
  }

  return bounded
}
