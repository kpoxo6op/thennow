"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronsLeftRight } from "lucide-react"
import Image from "next/image"

import { COMPARE_SIDE_GUTTER_PX } from "@/lib/compare"
import { cn } from "@/lib/utils"

interface Props {
  name: string
  thenSrc: string
  nowSrc: string
  ratio: number
  position: number
  onPositionChange: (position: number) => void
  onInteract?: () => void
  fit?: "contain" | "cover"
  priority?: boolean
  className?: string
}

const TOUCH_SLOP_PX = 4

// The reveal travels over the photograph, never over the empty space beside it.
function getGutter(width: number, height: number, ratio: number, fit: Props["fit"]) {
  if (fit === "cover") {
    return COMPARE_SIDE_GUTTER_PX
  }

  return Math.max(COMPARE_SIDE_GUTTER_PX, (width - Math.min(width, height * ratio)) / 2)
}

export function CompareStage({
  name,
  thenSrc,
  nowSrc,
  ratio,
  position,
  onPositionChange,
  onInteract,
  fit = "contain",
  priority = false,
  className,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<{ startX: number; moved: boolean; touch: boolean } | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const stage = stageRef.current

    if (!stage) {
      return
    }

    const measure = () => {
      const { width, height } = stage.getBoundingClientRect()
      setSize({ width, height })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)

    return () => {
      observer.disconnect()
    }
  }, [])

  const moveTo = useCallback(
    (clientX: number) => {
      const rect = stageRef.current?.getBoundingClientRect()

      if (!rect || rect.width === 0) {
        return
      }

      const gutter = getGutter(rect.width, rect.height, ratio, fit)
      const activeWidth = Math.max(rect.width - gutter * 2, 1)
      const next = ((clientX - rect.left - gutter) / activeWidth) * 100
      onPositionChange(Math.min(100, Math.max(0, next)))
    },
    [fit, onPositionChange, ratio]
  )

  const measured = size.width > 0
  const bounded = Math.min(100, Math.max(0, position))
  const gutter = getGutter(size.width, size.height, ratio, fit)
  const revealX = gutter + (bounded / 100) * Math.max(size.width - gutter * 2, 0)
  const lineLeft = measured ? `${revealX}px` : `${bounded}%`
  const imageClass = fit === "cover" ? "absolute inset-0" : "tn-compare-image"
  const sizes = "100vw"

  return (
    <div
      ref={stageRef}
      data-testid="compare-stage"
      className={cn(
        "relative w-full cursor-ew-resize touch-pan-y select-none overflow-hidden",
        className
      )}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
          return
        }

        event.currentTarget.setPointerCapture(event.pointerId)
        onInteract?.()
        const touch = event.pointerType !== "mouse"
        gestureRef.current = { startX: event.clientX, moved: false, touch }

        // A touch may become a page scroll, so it only moves the line once it is clearly not one.
        if (!touch) {
          moveTo(event.clientX)
        }
      }}
      onPointerMove={(event) => {
        const gesture = gestureRef.current

        if (!gesture) {
          return
        }

        if (gesture.touch && !gesture.moved && Math.abs(event.clientX - gesture.startX) < TOUCH_SLOP_PX) {
          return
        }

        gesture.moved = true
        moveTo(event.clientX)
      }}
      onPointerUp={(event) => {
        const gesture = gestureRef.current

        if (gesture?.touch && !gesture.moved) {
          moveTo(event.clientX)
        }

        gestureRef.current = null
      }}
      onPointerCancel={() => {
        gestureRef.current = null
      }}
    >
      <div className={imageClass}>
        <Image
          src={nowSrc}
          alt={`${name}, now`}
          data-testid="compare-base-image"
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
          draggable={false}
        />
      </div>
      <div
        data-testid="compare-overlay"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          clipPath: measured
            ? `inset(0 ${Math.max(0, size.width - revealX)}px 0 0)`
            : `inset(0 ${100 - bounded}% 0 0)`,
        }}
      >
        <div className={imageClass}>
          <Image
            src={thenSrc}
            alt={`${name}, then`}
            data-testid="compare-overlay-image"
            fill
            priority={priority}
            sizes={sizes}
            className="object-cover"
            draggable={false}
          />
        </div>
      </div>

      <input
        type="range"
        data-testid="compare-slider-input"
        aria-label={`Compare ${name} then and now`}
        aria-valuetext={`${Math.round(bounded)}% then`}
        min={0}
        max={100}
        step={1}
        value={Math.round(bounded)}
        onChange={(event) => {
          onInteract?.()
          onPositionChange(Number(event.target.value))
        }}
        className="tn-compare-input peer absolute inset-y-0"
        style={{ left: `${gutter}px`, width: measured ? `${size.width - gutter * 2}px` : undefined }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_6px_rgb(0_0_0/0.55)]"
        style={{ left: lineLeft }}
      />
      <div
        data-testid="compare-slider-knob"
        aria-hidden
        className="pointer-events-none absolute top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-[0_2px_12px_rgb(0_0_0/0.45)] peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white"
        style={{ left: lineLeft }}
      >
        <ChevronsLeftRight className="size-5" />
      </div>
    </div>
  )
}
