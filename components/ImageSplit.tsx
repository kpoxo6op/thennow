"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"

import { COMPARE_SIDE_GUTTER_PX } from "@/lib/compare"
import PostType from "@/interfaces/post"
import { cn } from "@/lib/utils"

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  post: PostType
  position: number
  onPositionChange?: (position: number) => void
}

const ImageSplit = ({ post, position, className, onPositionChange, ...props }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const updateContainerWidth = () => {
      setContainerWidth(containerRef.current?.getBoundingClientRect().width ?? 0)
    }

    updateContainerWidth()
    window.addEventListener("resize", updateContainerWidth)

    return () => {
      window.removeEventListener("resize", updateContainerWidth)
    }
  }, [])

  const updatePosition = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()

    if (!rect || rect.width === 0) {
      return
    }

    const activeWidth = Math.max(rect.width - COMPARE_SIDE_GUTTER_PX * 2, 1)
    const clampedClientX = Math.min(
      rect.right - COMPARE_SIDE_GUTTER_PX,
      Math.max(rect.left + COMPARE_SIDE_GUTTER_PX, clientX)
    )
    const nextPosition = ((clampedClientX - rect.left - COMPARE_SIDE_GUTTER_PX) / activeWidth) * 100
    const boundedPosition = Math.min(100, Math.max(0, nextPosition))
    onPositionChange?.(boundedPosition)
  }, [onPositionChange])

  const clipRightInset =
    containerWidth > 0
      ? Math.max(
          0,
          containerWidth -
            (COMPARE_SIDE_GUTTER_PX +
              (Math.min(100, Math.max(0, position)) / 100) *
                Math.max(containerWidth - COMPARE_SIDE_GUTTER_PX * 2, 0))
        )
      : 0

  return (
    <section
      className={cn("flex flex-1 flex-col items-center", className)}
      {...props}
    >
      <div
        ref={containerRef}
        data-testid="compare-stage"
        className="relative h-screen w-screen cursor-ew-resize overflow-hidden touch-none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          updatePosition(event.clientX)
        }}
        onPointerMove={(event) => {
          if ((event.buttons & 1) !== 1) {
            return
          }

          updatePosition(event.clientX)
        }}
      >
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
        <div
          data-testid="compare-overlay"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${clipRightInset}px 0 0)` }}
        >
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
    </section>
  )
}

ImageSplit.displayName = "ImageSplit"

export default ImageSplit
