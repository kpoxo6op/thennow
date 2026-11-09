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
  return (
    <Link
      href={href}
      onClick={() => landscape && turnScreen("landscape")}
      {...rest}
    >
      {children}
    </Link>
  )
}

type Lockable = ScreenOrientation & {
  lock?: (orientation: "landscape" | "portrait") => Promise<void>
}

// Whether a tap can turn the screen: Android browsers on a phone, not iPhones.
export function canTurnScreen() {
  return (
    typeof document !== "undefined" &&
    document.fullscreenEnabled &&
    !!(screen.orientation as Lockable)?.lock &&
    matchMedia("(pointer: coarse)").matches
  )
}

// Full screen and turned, from a tap; nothing where the browser doesn't allow it.
export function turnScreen(to: "landscape" | "portrait") {
  if (!canTurnScreen()) return
  const orientation = screen.orientation as Lockable
  const full = document.fullscreenElement
    ? Promise.resolve()
    : document.documentElement.requestFullscreen({ navigationUI: "hide" })
  full
    .then(() => orientation.lock!(to))
    .then(() => report("turned", { to }, { ok: true }))
    .catch((error) => {
      report(
        "turned",
        { to, message: String(error).slice(0, 120) },
        { ok: false }
      )
      if (document.fullscreenElement) void document.exitFullscreen()
    })
}

// Hands the screen back when the camera is left.
export function releaseScreen() {
  try {
    screen.orientation?.unlock?.()
  } catch {}
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
}
