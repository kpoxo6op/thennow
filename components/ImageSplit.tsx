"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"

import { COMPARE_SIDE_GUTTER_PX } from "@/lib/compare"
import PostType from "@/interfaces/post"
import { cn } from "@/lib/utils"

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  post: PostType
  position: number
  immersive?: boolean
  onPositionChange?: (position: number) => void
  onTap?: () => void
}

const TAP_SLOP_PX = 5

// The reveal travels over the photograph, never over the empty space beside it.
function getGutter(width: number, height: number, ratio: number) {
  const imageWidth = Math.min(width, height * ratio)

  return Math.max(COMPARE_SIDE_GUTTER_PX, (width - imageWidth) / 2)
}

const ImageSplit = ({
  post,
  position,
  immersive = false,
  className,
  onPositionChange,
  onTap,
  ...props
}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const ratio = post.w / post.h

  useEffect(() => {
    const stage = containerRef.current

    if (!stage) {
      return
    }

    const updateStageSize = () => {
      const { width, height } = stage.getBoundingClientRect()
      setStageSize({ width, height })
    }

    updateStageSize()
    const observer = new ResizeObserver(updateStageSize)
    observer.observe(stage)

    return () => {
      observer.disconnect()
    }
  }, [])

  const updatePosition = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()

    if (!rect || rect.width === 0) {
      return
    }

    const gutter = getGutter(rect.width, rect.height, ratio)
    const activeWidth = Math.max(rect.width - gutter * 2, 1)
    const clampedClientX = Math.min(
      rect.right - gutter,
      Math.max(rect.left + gutter, clientX)
    )
    const nextPosition = ((clampedClientX - rect.left - gutter) / activeWidth) * 100
    const boundedPosition = Math.min(100, Math.max(0, nextPosition))
    onPositionChange?.(boundedPosition)
  }, [onPositionChange, ratio])

  const measured = stageSize.width > 0
  const boundedPosition = Math.min(100, Math.max(0, position))
  const gutter = getGutter(stageSize.width, stageSize.height, ratio)
  const revealX = gutter + (boundedPosition / 100) * Math.max(stageSize.width - gutter * 2, 0)
  const clipRightInset = Math.max(0, stageSize.width - revealX)
  const imageHeight = Math.min(stageSize.height, stageSize.width / ratio)

  return (
    <div
      ref={containerRef}
      data-testid="compare-stage"
      data-immersive={immersive}
      className={cn(
        "tn-story-stage relative w-full cursor-ew-resize touch-pan-y select-none overflow-hidden",
        className
      )}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        gestureRef.current = { startX: event.clientX, startY: event.clientY, moved: false }
      }}
      onPointerMove={(event) => {
        const gesture = gestureRef.current

        if (!gesture) {
          return
        }

        if (
          !gesture.moved &&
          Math.abs(event.clientX - gesture.startX) < TAP_SLOP_PX &&
          Math.abs(event.clientY - gesture.startY) < TAP_SLOP_PX
        ) {
          return
        }

        gesture.moved = true
        updatePosition(event.clientX)
      }}
      onPointerUp={() => {
        if (gestureRef.current && !gestureRef.current.moved) {
          onTap?.()
        }

        gestureRef.current = null
      }}
      onPointerCancel={() => {
        gestureRef.current = null
      }}
      {...props}
    >
      <div className="tn-story-image">
        <Image
          src={post.a_imageUrl}
          alt={post.name}
          data-testid="compare-base-image"
          fill
          priority
          sizes="100vw"
          className="object-cover"
          draggable={false}
        />
      </div>
      <div
        data-testid="compare-overlay"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          clipPath: measured
            ? `inset(0 ${clipRightInset}px 0 0)`
            : `inset(0 ${100 - boundedPosition}% 0 0)`,
        }}
      >
        <div className="tn-story-image">
          <Image
            src={post.b_imageUrl}
            alt={post.name}
            data-testid="compare-overlay-image"
            fill
            priority
            sizes="100vw"
            className="object-cover"
            draggable={false}
          />
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 h-full w-px -translate-x-1/2 -translate-y-1/2 bg-white shadow-[0_0_6px_rgb(0_0_0/0.6)]"
        style={
          measured
            ? { left: `${revealX}px`, height: `${imageHeight}px` }
            : { left: `${boundedPosition}%` }
        }
      />
    </div>
  )
}

ImageSplit.displayName = "ImageSplit"

export default ImageSplit
