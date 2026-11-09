"use client"

import { useEffect } from "react"

// Looking at Your photos keeps the phone's cookie from running out, like using the camera does.
export function MeRenew() {
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" }).catch(() => {})
  }, [])
  return null
}
