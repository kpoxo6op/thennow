"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { CompareStage } from "@/components/compare-stage"
import { CompareYears } from "@/components/compare-years"

interface Props {
  name: string
  thenSrc: string
  nowSrc: string
  ratio: number
  thenYear?: string
  nowYear?: string
  // Belongs to the photograph: its own place, directly under it.
  caption: React.ReactNode
}

const SWEEP = [
  { at: 0, position: 50 },
  { at: 1100, position: 22 },
  { at: 2400, position: 50 },
]
const SWEEP_DELAY_MS = 900
// It teaches once a visit; coming back to the page shouldn't teach it again.
let hasSwept = false

function ease(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

// One slow pass of the line says what this site is before anything is read.
export function HomeHero({ name, thenSrc, nowSrc, ratio, thenYear, nowYear, caption }: Props) {
  const [position, setPosition] = useState(50)
  const [touched, setTouched] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (hasSwept || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    hasSwept = true

    let frame = 0
    let start: number | null = null

    const step = (now: number) => {
      start ??= now
      const elapsed = now - start - SWEEP_DELAY_MS

      if (elapsed >= 0) {
        const nextIndex = SWEEP.findIndex((point) => point.at > elapsed)

        if (nextIndex === -1) {
          setPosition(50)
          return
        }

        const from = SWEEP[nextIndex - 1]
        const to = SWEEP[nextIndex]
        const t = ease((elapsed - from.at) / (to.at - from.at))
        setPosition(from.position + (to.position - from.position) * t)
      }

      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    cancelRef.current = () => cancelAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [])

  const handleInteract = useCallback(() => {
    cancelRef.current?.()
    setTouched(true)
  }, [])

  return (
    <div className="tn-home-hero">
      <div className="relative">
        <CompareStage
          name={name}
          thenSrc={thenSrc}
          nowSrc={nowSrc}
          ratio={ratio}
          position={position}
          onPositionChange={setPosition}
          onInteract={handleInteract}
          fit="cover"
          priority
          className="h-[42svh] min-h-56 md:h-[min(calc(100svh-var(--header-h)-var(--hero-caption-h)-var(--hero-band-h)-var(--hero-peek)),66vw)] md:min-h-72"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <CompareYears position={position} thenYear={thenYear} nowYear={nowYear} />
          {touched ? null : (
            <span
              data-testid="hero-drag-hint"
              className="absolute top-[calc(50%+2rem)] -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-3 py-1 text-sm text-white"
              style={{ left: `${position}%` }}
            >
              Drag the line
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center px-4 md:h-[var(--hero-caption-h)]">
        {caption}
      </div>
    </div>
  )
}
