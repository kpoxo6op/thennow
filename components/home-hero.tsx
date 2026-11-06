"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { CompareStage } from "@/components/compare-stage"

interface Props {
  name: string
  thenSrc: string
  nowSrc: string
  ratio: number
}

const SWEEP = [
  { at: 0, position: 50 },
  { at: 900, position: 24 },
  { at: 2100, position: 76 },
  { at: 3000, position: 50 },
]
const SWEEP_DELAY_MS = 900

function ease(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

// One slow pass of the line says what this site is before anything is read.
export function HomeHero({ name, thenSrc, nowSrc, ratio }: Props) {
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

  return (
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
      className="h-[52svh] min-h-72 md:h-[min(calc(100svh-3.5rem-15rem),66vw)] md:min-h-72"
    />
  )
}
