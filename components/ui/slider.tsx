"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

type SliderProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange"> & {
  value?: number[]
  defaultValue?: number[]
  onValueChange?: (value: number[]) => void
  // Where the grip sits along the range, when that isn't simply the value.
  gripPercent?: number
}

// The grip sits on the photo. Only the input takes pointer events, in a strip
// along the photo's lower edge; the rest of the photo is the stage's to drag.
const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, defaultValue, min = 0, max = 100, step = 1, onValueChange, gripPercent, ...props }, ref) => {
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
      <div data-testid="compare-slider-root" className={cn("group pointer-events-none", className)}>
        <div
          data-testid="compare-slider-knob"
          className="absolute top-1/2 z-20 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-900 shadow-[0_1px_8px_rgb(0_0_0/0.45)] group-has-[input:focus-visible]:outline-2 group-has-[input:focus-visible]:outline-offset-2 group-has-[input:focus-visible]:outline-white"
          style={{
            left: `${gripPercent ?? percent}%`,
          }}
        >
          <ChevronLeft aria-hidden className="-mr-1 size-4" />
          <ChevronRight aria-hidden className="-ml-1 size-4" />
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
          className="tn-slider pointer-events-auto absolute inset-x-0 bottom-0 z-10 m-0 h-11 w-full cursor-ew-resize appearance-none bg-transparent outline-none"
          {...props}
        />
      </div>
    )
  }
)

Slider.displayName = "Slider"

export { Slider }
