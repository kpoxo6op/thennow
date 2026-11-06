"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { CompareStage } from "@/components/compare-stage"

interface Props {
  name: string
  thenSrc: string
  nowSrc: string
  ratio: number
  thenYear?: string
  nowYear?: string
}

const SWEEP = [
  { at: 0, position: 50 },
  { at: 900, position: 24 },
  { at: 2100, position: 76 },
  { at: 3000, position: 50 },
]
const SWEEP_DELAY_MS = 900
// Past here a year would run off the photograph, so it steps aside.
const YEAR_ROOM_PERCENT = 30

function ease(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

// One slow pass of the line says what this site is before anything is read.
export function HomeHero({ name, thenSrc, nowSrc, ratio, thenYear, nowYear }: Props) {
  const [position, setPosition] = useState(50)
  const cancelRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

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
  }, [])

  const yearClass =
    "tn-seam-year absolute top-1/2 -translate-y-1/2 font-serif text-5xl leading-none text-white transition-opacity duration-200 md:text-[5.5rem]"

  return (
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
        className="h-[50svh] min-h-64 md:h-svh md:min-h-[38rem]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0" style={{ left: `${position}%` }}>
          <span
            className={`${yearClass} right-9 md:right-12`}
            style={{ opacity: position < YEAR_ROOM_PERCENT ? 0 : 1 }}
          >
            {thenYear}
          </span>
          <span
            className={`${yearClass} left-9 md:left-12`}
            style={{ opacity: position > 100 - YEAR_ROOM_PERCENT ? 0 : 1 }}
          >
            {nowYear}
          </span>
        </div>
      </div>
    </div>
  )
}
