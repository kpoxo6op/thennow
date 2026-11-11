"use client"

import { useRef, type PointerEvent } from "react"
import { ChevronsLeftRight } from "lucide-react"

// This control changes only the reveal. The matcher continues to place the archive.
export function LiveDivider({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  const area = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; value: number } | null>(null)
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const box = area.current?.getBoundingClientRect()
    if (box && drag.current) {
      const next =
        drag.current.value +
        ((event.clientX - drag.current.x) / box.width) * 100
      // Reach either full view without dragging into the phone's edge gestures.
      onChange(next <= 5 ? 0 : next >= 95 ? 100 : next)
    }
  }
  return (
    <div ref={area} className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-y-0 border-l border-white/90"
        style={{ left: `${value}%` }}
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Compare old photo with live camera"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${Math.round(value)} percent old photo`}
        data-testid="live-divider"
        className="pointer-events-auto absolute top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full bg-black/75 outline-offset-2 focus-visible:outline focus-visible:outline-white"
        style={{ left: `clamp(22px, ${value}%, calc(100% - 22px))` }}
        onPointerDown={(event) => {
          event.stopPropagation()
          drag.current = { x: event.clientX, value }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            move(event)
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            drag.current = null
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
        onLostPointerCapture={() => {
          drag.current = null
        }}
        onKeyDown={(event) => {
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? 100
                : event.key === "ArrowLeft"
                  ? value - 5
                  : event.key === "ArrowRight"
                    ? value + 5
                    : null
          if (next != null) {
            event.preventDefault()
            onChange(Math.max(0, Math.min(100, next)))
          }
        }}
      >
        <ChevronsLeftRight className="size-5" aria-hidden />
      </div>
      <span
        className="absolute left-3 top-3 rounded bg-black/65 px-2 py-0.5 text-xs"
        hidden={value < 15}
      >
        Old
      </span>
      <span
        className="absolute right-3 top-3 rounded bg-black/65 px-2 py-0.5 text-xs"
        hidden={value > 85}
      >
        Live
      </span>
    </div>
  )
}
