export const COMPARE_SIDE_GUTTER_PX = 40

// Android reserves up to about 40dp at each screen edge for its back gesture, and a page cannot
// opt out. A touch drag stops with the line here, so half a knob still sits outside that margin
// and the next grab starts on the page, not on the system.
export const COMPARE_LINE_SAFE_PX = 56
