"use client"

import * as React from "react"
import { Maximize2, X } from "lucide-react"

import { COMPARE_SIDE_GUTTER_PX, compareLinePercent } from "@/lib/compare"
import { cn } from "@/lib/utils"
import ImageSplit from "@/components/ImageSplit"
import { Slider } from "@/components/ui/slider"

type ComparePost = {
  name: string
  a_imageUrl: string
  b_imageUrl: string
  w: number
  h: number
}

interface CompareFrameProps {
  post: ComparePost
  position: number
  onPositionChange: (position: number) => void
  sizes: string
  variant?: "story" | "hero"
  className?: string
}

const DEFAULT_POSITION = 50
// The marks step aside just before the divider reaches them.
const MARK_CLEARANCE = 14

export function CompareFrame({
  post,
  position,
  onPositionChange,
  sizes,
  variant = "story",
  className,
}: CompareFrameProps) {
  const [photoOnly, setPhotoOnly] = React.useState(false)
  const [heldHeight, setHeldHeight] = React.useState<number>()
  const rootRef = React.useRef<HTMLDivElement>(null)
  const expandRef = React.useRef<HTMLButtonElement>(null)
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const isHero = variant === "hero"
  const photoRef = React.useRef<HTMLDivElement>(null)
  const frameRef = React.useRef<HTMLDivElement>(null)
  const rangeRef = React.useRef<HTMLDivElement>(null)
  const [geometry, setGeometry] = React.useState<{
    stage: number
    rangeLeft: number
    rangeWidth: number
    overhangLeft: number
    overhangRight: number
  } | null>(null)

  React.useLayoutEffect(() => {
    const measure = () => {
      const photo = photoRef.current?.getBoundingClientRect()
      const frame = frameRef.current?.getBoundingClientRect()
      const range = rangeRef.current?.getBoundingClientRect()

      if (photo && frame && range && range.width > 0) {
        setGeometry({
          stage: photo.width,
          rangeLeft: range.left - photo.left,
          rangeWidth: range.width,
          overhangLeft: Math.max(0, ((range.left - frame.left) / range.width) * 100),
          overhangRight: Math.max(0, ((frame.right - range.right) / range.width) * 100),
        })
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    if (photoRef.current) {
      observer.observe(photoRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const linePercent = compareLinePercent(
    position,
    geometry?.overhangLeft ?? 0,
    geometry?.overhangRight ?? 0
  )

  React.useEffect(() => {
    if (!photoOnly) {
      return
    }

    const button = expandRef
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPhotoOnly(false)
      }
    }

    closeRef.current?.focus()
    document.addEventListener("keydown", closeOnEscape)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", closeOnEscape)
      document.body.style.overflow = ""
      button.current?.focus()
    }
  }, [photoOnly])

  return (
    <div
      ref={rootRef}
      // Full screen leaves the page flow; the page must not shift beneath it.
      style={photoOnly ? { minHeight: heldHeight } : undefined}
      className={cn(
        // A container could trap the fixed photo view; viewport units take over.
        !photoOnly && "[container-type:inline-size]",
        !photoOnly && !isHero && "tn-compare-sticky",
        className
      )}
    >
      <div
        className={cn("tn-compare w-full", isHero && "tn-compare--hero")}
        data-focus={photoOnly}
        style={
          {
            "--compare-ratio": post.w / post.h,
            "--compare-min-gutter": `${COMPARE_SIDE_GUTTER_PX}px`,
          } as React.CSSProperties
        }
      >
        <div
          className={cn(
            "relative",
            photoOnly &&
              "fixed inset-0 z-40 flex items-center bg-black animate-in fade-in duration-200"
          )}
          role={photoOnly ? "dialog" : undefined}
          aria-modal={photoOnly ? true : undefined}
          aria-label={photoOnly ? post.name : undefined}
          onClick={(event) => {
            if (photoOnly && event.target === event.currentTarget) {
              setPhotoOnly(false)
            }
          }}
          onKeyDown={(event) => {
            if (!photoOnly || event.key !== "Tab") {
              return
            }

            // Only the slider and Close exist in this view.
            const controls = [
              ...event.currentTarget.querySelectorAll<HTMLElement>("input, button"),
            ]
            const last = controls.length - 1
            const index = controls.indexOf(document.activeElement as HTMLElement)
            const wraps = event.shiftKey ? index <= 0 : index === last

            if (wraps) {
              event.preventDefault()
              controls[event.shiftKey ? last : 0]?.focus()
            }
          }}
        >
          <div ref={photoRef} className="relative w-full overflow-hidden">
            <ImageSplit
              post={post}
              position={position}
              linePercent={linePercent}
              geometry={geometry}
              sizes={sizes}
              onPositionChange={onPositionChange}
              className={photoOnly ? "[touch-action:none]" : undefined}
            />
            <div ref={frameRef} className="tn-compare-frame pointer-events-none flex items-end justify-between p-2 sm:p-3">
              <span
                className="tn-compare-mark"
                style={{ opacity: position < MARK_CLEARANCE ? 0 : 1 }}
              >
                then
              </span>
              <span
                className="tn-compare-mark"
                style={{ opacity: position > 100 - MARK_CLEARANCE ? 0 : 1 }}
              >
                now
              </span>
            </div>
            <div ref={rangeRef} className="tn-compare-range pointer-events-none">
              <Slider
                aria-label={`Compare ${post.name}, then and now`}
                className="absolute inset-0"
                value={[position]}
                gripPercent={linePercent}
                onValueChange={(value) => {
                  onPositionChange(value[0] ?? DEFAULT_POSITION)
                }}
              />
            </div>
            {!isHero && !photoOnly && (
              <div className="tn-compare-frame pointer-events-none">
                <button
                  ref={expandRef}
                  type="button"
                  aria-label="View photograph full screen"
                  data-testid="compare-expand"
                  onClick={() => {
                    setHeldHeight(rootRef.current?.offsetHeight)
                    setPhotoOnly(true)
                  }}
                  className="pointer-events-auto absolute right-2 top-2 flex size-11 items-center justify-center rounded-sm bg-black/55 text-white transition-colors hover:bg-black/75 focus-visible:outline-white sm:right-3 sm:top-3"
                >
                  <Maximize2 aria-hidden className="size-5" />
                </button>
              </div>
            )}
          </div>
          {photoOnly && (
            <button
              ref={closeRef}
              type="button"
              aria-label="Close full screen"
              data-testid="compare-close"
              onClick={() => setPhotoOnly(false)}
              className="fixed right-3 top-3 z-50 flex size-11 items-center justify-center rounded-sm bg-black/55 text-white transition-colors hover:bg-black/75 focus-visible:outline-white"
            >
              <X aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
