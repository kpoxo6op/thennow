"use client"

import React, { useCallback, useRef } from "react"
import Image from "next/image"

import { COMPARE_SIDE_GUTTER_PX } from "@/lib/compare"
import { cn } from "@/lib/utils"

type ComparePhotos = {
  name: string
  a_imageUrl: string
  b_imageUrl: string
}

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  post: ComparePhotos
  position: number
  // The stage and photograph in pixels, once measured; before that the clip is by share.
  geometry: { stage: number; frameLeft: number; frameWidth: number } | null
  sizes: string
  onPositionChange?: (position: number) => void
}

const TOUCH_DRAG_TOLERANCE_PX = 4
// Half the grip: pressing this close to the line takes hold of it where it is.
const GRAB_RADIUS_PX = 22
// A finger can't land on the last pixel, so this close to an edge counts as it.
const EDGE_SNAP_PX = 4
// Over this distance from an edge, a grab's offset eases out so the edge is reached.
const GRAB_EASE_PX = 24

const ImageSplit = ({ post, position, geometry, sizes, className, onPositionChange, ...props }: Props) => {
  const frameRef = useRef<HTMLDivElement>(null)
  const pressRef = useRef<{ x: number; moved: boolean; onLine: boolean; offset: number } | null>(null)

  // A position is a share of the photograph, so the line sits under the pointer.
  const positionAt = useCallback((clientX: number, offset: number) => {
    const rect = frameRef.current?.getBoundingClientRect()

    if (!rect || rect.width === 0) {
      return null
    }

    const edgeDistance = Math.min(clientX - rect.left, rect.right - clientX)
    const ease = Math.min(1, Math.max(0, edgeDistance / GRAB_EASE_PX))
    const x = clientX + offset * ease

    if (x - rect.left <= EDGE_SNAP_PX) {
      return 0
    }

    if (rect.right - x <= EDGE_SNAP_PX) {
      return 100
    }

    return ((x - rect.left) / rect.width) * 100
  }, [])

  const moveTo = useCallback((clientX: number, offset: number) => {
    const next = positionAt(clientX, offset)

    if (next !== null) {
      onPositionChange?.(next)
    }
  }, [onPositionChange, positionAt])

  const clipRight = geometry
    ? geometry.stage - (geometry.frameLeft + (position / 100) * geometry.frameWidth)
    : null
  const clipPath =
    clipRight === null
      ? `inset(0 ${100 - position}% 0 0)`
      : `inset(0 ${Math.max(0, Math.round(clipRight * 100) / 100)}px 0 0)`

  return (
    <div
      data-testid="compare-stage"
      className={cn(
        "relative w-full cursor-ew-resize select-none overflow-hidden [touch-action:pan-y]",
        className
      )}
      style={{ height: "var(--compare-stage-height)" }}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return
        }

        const isMouse = event.pointerType === "mouse"

        // A touch starting at the screen edge belongs to the system's gestures.
        if (
          !isMouse &&
          (event.clientX < COMPARE_SIDE_GUTTER_PX ||
            event.clientX > window.innerWidth - COMPARE_SIDE_GUTTER_PX)
        ) {
          pressRef.current = null
          return
        }

        const rect = frameRef.current?.getBoundingClientRect()
        const lineX = rect ? rect.left + (position / 100) * rect.width : event.clientX
        const onLine = Math.abs(event.clientX - lineX) <= GRAB_RADIUS_PX

        event.currentTarget.setPointerCapture(event.pointerId)
        pressRef.current = {
          x: event.clientX,
          moved: false,
          onLine,
          offset: onLine ? lineX - event.clientX : 0,
        }

        // On touch the press may become a page scroll, so wait to see which.
        if (isMouse && !onLine) {
          moveTo(event.clientX, 0)
        }
      }}
      onPointerMove={(event) => {
        const press = pressRef.current

        if (!press || (event.buttons & 1) !== 1) {
          return
        }

        const tolerance = event.pointerType === "mouse" ? 0 : TOUCH_DRAG_TOLERANCE_PX

        if (!press.moved && Math.abs(event.clientX - press.x) <= tolerance) {
          return
        }

        press.moved = true
        moveTo(event.clientX, press.offset)
      }}
      onPointerUp={(event) => {
        const press = pressRef.current

        if (press && !press.moved && !press.onLine) {
          moveTo(event.clientX, 0)
        }

        pressRef.current = null
      }}
      onPointerCancel={() => {
        pressRef.current = null
      }}
      {...props}
    >
      <div className="tn-compare-frame bg-muted">
        <Image
          src={post.a_imageUrl}
          alt={`${post.name}, now`}
          data-testid="compare-base-image"
          fill
          priority
          sizes={sizes}
          className="object-cover"
          draggable={false}
        />
      </div>
      <div
        data-testid="compare-overlay"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ clipPath }}
      >
        <div className="tn-compare-frame">
          <Image
            src={post.b_imageUrl}
            alt={`${post.name}, then`}
            data-testid="compare-overlay-image"
            fill
            priority
            sizes={sizes}
            className="object-cover"
            draggable={false}
          />
        </div>
      </div>
      <div ref={frameRef} className="tn-compare-frame pointer-events-none">
        <div
          data-testid="compare-divider"
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_4px_rgb(0_0_0/0.5)]"
          style={{ left: `${position}%` }}
        />
      </div>
    </div>
  )
}

ImageSplit.displayName = "ImageSplit"

export default ImageSplit
