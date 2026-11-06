"use client"

import { useLayoutEffect } from "react"

// A long collection leaves the window scrolled; the short page that follows
// would otherwise open clamped partway down, with its top under the header.
export function ResetScroll() {
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return null
}
