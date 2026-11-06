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
    const percent = ((renderedValue - Number(min)) / (Number(max) - Number(min))) * 100

    return (
      <div data-testid="compare-slider-root" className={cn("group relative flex w-full items-center", className)}>
        <div className="pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-border" />
        <div
          data-testid="compare-slider-progress"
          className="pointer-events-none absolute left-0 h-0.5 rounded-full bg-foreground/60"
          style={{
            width: `${percent}%`,
          }}
        />
        <div
          className="pointer-events-none absolute top-0 h-1/2 w-0.5 -translate-x-1/2 bg-foreground"
          style={{
            left: `${percent}%`,
          }}
        />
        <div
          data-testid="compare-slider-knob"
          className="pointer-events-none absolute top-1/2 z-20 size-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-sm transition-[scale] group-active:scale-110 group-has-[input:focus-visible]:outline-2 group-has-[input:focus-visible]:outline-offset-2 group-has-[input:focus-visible]:outline-foreground"
          style={{
            left: `${percent}%`,
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
          className="tn-slider relative z-10 h-11 w-full appearance-none bg-transparent outline-none"
          {...props}
        />
      </div>
    )
  }
)

Slider.displayName = "Slider"

export { Slider }
