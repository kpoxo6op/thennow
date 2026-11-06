"use client"

import * as React from "react"
import { ChevronsLeftRight } from "lucide-react"

import { cn } from "@/lib/utils"

type SliderProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange"> & {
  value?: number[]
  defaultValue?: number[]
  onValueChange?: (value: number[]) => void
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, defaultValue, min = 0, max = 100, step = 1, onValueChange, ...props }, ref) => {
    const isControlled = value !== undefined
    const currentValue = Number((isControlled ? value?.[0] : defaultValue?.[0]) ?? min)
    const [internalValue, setInternalValue] = React.useState(currentValue)

    React.useEffect(() => {
      if (isControlled) {
        setInternalValue(currentValue)
      }
    }, [currentValue, isControlled])

    const setRefs = (node: HTMLInputElement | null) => {
      if (typeof ref === "function") {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
    }

    const handleValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = Number(event.target.value)

      if (!isControlled) {
        setInternalValue(nextValue)
      }

      onValueChange?.([nextValue])
    }

    const handleInput = (event: React.FormEvent<HTMLInputElement>) => {
      const nextValue = Number(event.currentTarget.value)

      if (!isControlled) {
        setInternalValue(nextValue)
      }

      onValueChange?.([nextValue])
    }

    const renderedValue = isControlled ? currentValue : internalValue

    const setFromTouch = (event: React.PointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
      const span = Number(max) - Number(min)
      const nextValue = Number(min) + Math.round((ratio * span) / Number(step)) * Number(step)

      if (!isControlled) {
        setInternalValue(nextValue)
      }

      onValueChange?.([nextValue])
    }

    return (
      <div
        data-testid="compare-slider-root"
        className={cn("group relative flex w-full touch-none items-center", className)}
        onPointerDown={(event) => {
          // The native range has no thumb to grab on touch screens.
          if (event.pointerType !== "mouse") {
            event.currentTarget.setPointerCapture(event.pointerId)
            setFromTouch(event)
          }
        }}
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse" && event.currentTarget.hasPointerCapture(event.pointerId)) {
            setFromTouch(event)
          }
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 h-px bg-border" />
        <div
          data-testid="compare-slider-progress"
          className="pointer-events-none absolute left-0 h-px bg-foreground"
          style={{
            width: `${((renderedValue - Number(min)) / (Number(max) - Number(min))) * 100}%`,
          }}
        />
        <div
          data-testid="compare-slider-knob"
          className="pointer-events-none absolute top-1/2 z-20 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-foreground text-background shadow-md transition-transform duration-150 group-has-[:active]:scale-110 group-has-[:focus-visible]:outline group-has-[:focus-visible]:outline-2 group-has-[:focus-visible]:outline-offset-2 group-has-[:focus-visible]:outline-ring"
          style={{
            left: `${((renderedValue - Number(min)) / (Number(max) - Number(min))) * 100}%`,
          }}
        >
          <ChevronsLeftRight aria-hidden className="size-4" />
        </div>
        <input
          ref={setRefs}
          type="range"
          data-testid="compare-slider-input"
          min={min}
          max={max}
          step={step}
          value={renderedValue}
          onChange={handleValueChange}
          onInput={handleInput}
          className="tn-slider relative z-10 h-11 w-full appearance-none bg-transparent outline-none"
          {...props}
        />
      </div>
    )
  }
)

Slider.displayName = "Slider"

export { Slider }
