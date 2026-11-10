"use client"

import { useState } from "react"

import { CompareStage } from "@/components/compare-stage"
import { CompareYears } from "@/components/compare-years"

interface Props {
  name: string
  thenSrc: string
  nowSrc: string
  ratio: number
  thenYear?: string
  nowYear?: string
  priority?: boolean
}

// A large pair of photographs is always the real thing, never a picture of the control.
export function InlineCompare({
  name,
  thenSrc,
  nowSrc,
  ratio,
  thenYear,
  nowYear,
  priority,
}: Props) {
  const [position, setPosition] = useState(50)

  return (
    <div
      className="tn-inline-compare relative"
      style={{ "--ratio": ratio } as React.CSSProperties}
    >
      <CompareStage
        name={name}
        thenSrc={thenSrc}
        nowSrc={nowSrc}
        ratio={ratio}
        position={position}
        onPositionChange={setPosition}
        testIdPrefix="inline"
        fit="cover"
        priority={priority}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <CompareYears
          position={position}
          thenYear={thenYear}
          nowYear={nowYear}
        />
      </div>
    </div>
  )
}
