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

type Gesture = {
  startX: number
  moved: boolean
  touch: boolean
  // Set when the grip was pressed: how far the divider sits from the pointer,
  // and how far the pointer then was from the edge it would otherwise never reach.
  grip: { offset: number; edgeRoom: number } | null
}

const TOUCH_SLOP_PX = 4
const GRIP_RADIUS_PX = 24
const OFFSET_EASE_PX = 48
// A finger can't land on the last pixel, and the ends are what people are after.
const END_SNAP_PX = 3

// Where the photograph actually sits inside the stage.
function getImageBounds(width: number, height: number, ratio: number, fit: Props["fit"]) {
  const fitted = Math.min(width, height * ratio)
  // Under a pixel of difference is rounding, not space beside the photograph.
  const imageWidth = fit === "cover" || width - fitted < 1 ? width : fitted

  return { left: (width - imageWidth) / 2, width: imageWidth }
}

// Fingers stay clear of the screen edges, and of any empty space beside the photograph.
function getGutter(imageLeft: number) {
  return Math.max(COMPARE_SIDE_GUTTER_PX, imageLeft)
}

function pointerDividerX(
  clientX: number,
  grip: Gesture["grip"],
  image: { left: number; width: number }
) {
  if (!grip || grip.offset === 0) {
    return clientX
  }

  // An off-centre grab eases back onto the pointer so the far edge stays reachable.
  const room = grip.offset > 0 ? clientX - image.left : image.left + image.width - clientX
  const limit = Math.min(OFFSET_EASE_PX, grip.edgeRoom)
  const ease = room >= limit ? 1 : Math.max(0, room) / limit

  return clientX + grip.offset * ease
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
  const gestureRef = useRef<Gesture | null>(null)
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
    (clientX: number, grip: Gesture["grip"]) => {
      const rect = stageRef.current?.getBoundingClientRect()

      if (!rect || rect.width === 0) {
        return
      }

      const bounds = getImageBounds(rect.width, rect.height, ratio, fit)
      const image = { left: rect.left + bounds.left, width: bounds.width }
      const x = pointerDividerX(clientX, grip, image)
      const right = image.left + image.width

      if (x <= image.left + END_SNAP_PX) {
        onPositionChange(0)
      } else if (x >= right - END_SNAP_PX) {
        onPositionChange(100)
      } else {
        onPositionChange(((x - image.left) / image.width) * 100)
      }
    },
    [fit, onPositionChange, ratio]
  )

  const measured = size.width > 0
  const bounded = Math.min(100, Math.max(0, position))
  const image = getImageBounds(size.width, size.height, ratio, fit)
  const gutter = getGutter(image.left)
  // The divider travels the whole photograph, so 0 and 100 show each one complete.
  const revealX = image.left + (bounded / 100) * image.width
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

        const touch = event.pointerType !== "mouse"
        const rect = event.currentTarget.getBoundingClientRect()
        const bounds = getImageBounds(rect.width, rect.height, ratio, fit)
        const edge = getGutter(bounds.left)

        // Touches starting in the margins are left to the OS edge gestures.
        if (touch && (event.clientX < rect.left + edge || event.clientX > rect.right - edge)) {
          return
        }

        event.currentTarget.setPointerCapture(event.pointerId)
        onInteract?.()

        const dividerX = rect.left + bounds.left + (bounded / 100) * bounds.width
        const offset = dividerX - event.clientX
        const onGrip =
          Math.hypot(offset, rect.top + rect.height / 2 - event.clientY) <= GRIP_RADIUS_PX
        const edgeRoom =
          offset > 0
            ? event.clientX - rect.left - bounds.left
            : rect.left + bounds.left + bounds.width - event.clientX
        const grip = onGrip ? { offset, edgeRoom } : null

        gestureRef.current = { startX: event.clientX, moved: false, touch, grip }

        // A touch may become a page scroll, so it only moves the line once it is clearly not one.
        if (!touch && !grip) {
          moveTo(event.clientX, null)
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

        // Holding the grip still is not a move, even if the mouse reports one.
        if (!gesture.moved && event.clientX === gesture.startX) {
          return
        }

        gesture.moved = true
        moveTo(event.clientX, gesture.grip)
      }}
      onPointerUp={(event) => {
        const gesture = gestureRef.current

        if (gesture?.touch && !gesture.moved && !gesture.grip) {
          moveTo(event.clientX, null)
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
