"use client"

import React, { useCallback, useLayoutEffect, useRef, useState } from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

type ComparePhotos = {
  name: string
  a_imageUrl: string
  b_imageUrl: string
}

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  post: ComparePhotos
  position: number
  sizes: string
  onPositionChange?: (position: number) => void
}

const DRAG_TOLERANCE_PX = 4

const ImageSplit = ({ post, position, sizes, className, onPositionChange, ...props }: Props) => {
  const stageRef = useRef<HTMLDivElement>(null)
  const rangeRef = useRef<HTMLDivElement>(null)
  const pressRef = useRef<{ x: number; moved: boolean } | null>(null)
  const [geometry, setGeometry] = useState<{ stage: number; left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const measure = () => {
      const stageRect = stageRef.current?.getBoundingClientRect()
      const rangeRect = rangeRef.current?.getBoundingClientRect()

      if (stageRect && rangeRect) {
        setGeometry({
          stage: stageRect.width,
          left: rangeRect.left - stageRect.left,
          width: rangeRect.width,
        })
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    if (stageRef.current) {
      observer.observe(stageRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const updatePosition = useCallback((clientX: number) => {
    const rect = rangeRef.current?.getBoundingClientRect()

    if (!rect || rect.width === 0) {
      return
    }

    onPositionChange?.(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)))
  }, [onPositionChange])

  const boundedPosition = Math.min(100, Math.max(0, position))
  const clipPath = geometry
    ? `inset(0 ${Math.max(0, geometry.stage - (geometry.left + (boundedPosition / 100) * geometry.width))}px 0 0)`
    : `inset(0 ${100 - boundedPosition}% 0 0)`

  return (
    <div
      ref={stageRef}
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

        event.currentTarget.setPointerCapture(event.pointerId)
        pressRef.current = { x: event.clientX, moved: false }

        // On touch the press may become a page scroll, so wait to see which.
        if (event.pointerType === "mouse") {
          updatePosition(event.clientX)
        }
      }}
      onPointerMove={(event) => {
        const press = pressRef.current

        if (!press || (event.buttons & 1) !== 1) {
          return
        }

        if (!press.moved && Math.abs(event.clientX - press.x) < DRAG_TOLERANCE_PX) {
          return
        }

        press.moved = true
        updatePosition(event.clientX)
      }}
      onPointerUp={(event) => {
        if (pressRef.current && !pressRef.current.moved) {
          updatePosition(event.clientX)
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
      <div ref={rangeRef} className="tn-compare-range pointer-events-none">
        <div
          data-testid="compare-divider"
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_4px_rgb(0_0_0/0.5)]"
          style={{ left: `${boundedPosition}%` }}
        />
      </div>
    </div>
  )
}

ImageSplit.displayName = "ImageSplit"

export default ImageSplit
