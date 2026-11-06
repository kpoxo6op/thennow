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
  children?: React.ReactNode
}

const SWEEP = [
  { at: 0, position: 50 },
  { at: 1100, position: 22 },
  { at: 2400, position: 50 },
]
const SWEEP_DELAY_MS = 900
// Where the words on the road begin. A line past here, with a mouse still on the photograph, keeps them away.
const COPY_EDGE_PERCENT = 51

function ease(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

// One slow pass of the line says what this site is before anything is read.
export function HomeHero({ name, thenSrc, nowSrc, ratio, thenYear, nowYear, children }: Props) {
  const [position, setPosition] = useState(50)
  // The words sit on the dark road in the "now" half, and step aside while someone is studying what is under them.
  const [dragging, setDragging] = useState(false)
  const [mouseOnPhoto, setMouseOnPhoto] = useState(false)
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
    "tn-year absolute top-3 flex h-7 items-center justify-center rounded-full bg-black/70 font-serif text-[1.0625rem] leading-none text-white md:top-4 md:h-8 md:text-xl"
  const clear = dragging ? "drag" : mouseOnPhoto && position > COPY_EDGE_PERCENT ? "study" : undefined

  return (
    <div
      className="tn-home-hero"
      onPointerEnter={(event) => setMouseOnPhoto(event.pointerType === "mouse")}
      onPointerLeave={() => setMouseOnPhoto(false)}
    >
      <div
        className="relative"
        onPointerMove={(event) => {
          if (event.buttons > 0 && !dragging) {
            setDragging(true)
          }
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
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
          className="h-[54svh] min-h-64 md:h-[calc(100svh-var(--header-h))] md:min-h-[36rem]"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Each year stays beside the line, and inside the frame when the line nears an edge. */}
          <span
            className={yearClass}
            style={{ left: `max(0.5rem, calc(${position}% - 0.5rem - var(--pill)))` }}
          >
            {thenYear}
          </span>
          <span
            className={yearClass}
            style={{ left: `min(calc(100% - 0.5rem - var(--pill)), calc(${position}% + 0.5rem))` }}
          >
            {nowYear}
          </span>
        </div>
      </div>
      <div className="tn-hero-copy" data-clear={clear}>
        {children}
      </div>
    </div>
  )
}
