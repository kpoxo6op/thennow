"use client"

import type { ReactNode } from "react"
import Link from "next/link"

import { report } from "@/lib/rephoto/telemetry"

interface Props {
  href: string
  // The archive photograph is wider than tall.
  landscape: boolean
  className?: string
  children: ReactNode
  "data-testid"?: string
}

// Old photographs are nearly all landscape. Where the browser allows it (Android, from a tap),
// the camera opens full screen and turned sideways, like the phone's own camera. Elsewhere the
// camera asks to be turned.
export function CameraLink({ href, landscape, children, ...rest }: Props) {
  const turn = () => {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: "landscape") => Promise<void>
    }
    if (
      !landscape ||
      !document.fullscreenEnabled ||
      !orientation?.lock ||
      !matchMedia("(pointer: coarse)").matches
    )
      return
    document.documentElement
      .requestFullscreen({ navigationUI: "hide" })
      .then(() => orientation.lock!("landscape"))
      .then(() => report("turned", {}, { ok: true }))
      .catch((error) => {
        report(
          "turned",
          { message: String(error).slice(0, 120) },
          { ok: false }
        )
        if (document.fullscreenElement) void document.exitFullscreen()
      })
  }
  return (
    <Link href={href} onClick={turn} {...rest}>
      {children}
    </Link>
  )
}

// Hands the screen back when the camera is left.
export function releaseScreen() {
  try {
    screen.orientation?.unlock?.()
  } catch {}
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
}
