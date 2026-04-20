"use client"

import * as React from "react"

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

    return (
      <div data-testid="compare-slider-root" className={cn("relative flex w-full items-center", className)}>
        <div className="pointer-events-none absolute inset-x-0 h-2 rounded-full bg-secondary" />
        <div
          data-testid="compare-slider-progress"
          className="pointer-events-none absolute left-0 h-2 rounded-full bg-primary"
          style={{
            width: `${((renderedValue - Number(min)) / (Number(max) - Number(min))) * 100}%`,
          }}
        />
        <div
          data-testid="compare-slider-knob"
          className="pointer-events-none absolute top-1/2 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background"
          style={{
            left: `${((renderedValue - Number(min)) / (Number(max) - Number(min))) * 100}%`,
          }}
        />
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
          className="tn-slider relative z-10 h-5 w-full appearance-none bg-transparent"
          {...props}
        />
      </div>
    )
  }
)

Slider.displayName = "Slider"

export { Slider }
