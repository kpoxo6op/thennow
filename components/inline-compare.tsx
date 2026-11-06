"use client"

import { useState } from "react"

import { CompareStage } from "@/components/compare-stage"

interface Props {
  name: string
  thenSrc: string
  nowSrc: string
  ratio: number
  priority?: boolean
}

// A large pair of photographs is always the real thing, never a picture of the control.
export function InlineCompare({ name, thenSrc, nowSrc, ratio, priority }: Props) {
  const [position, setPosition] = useState(50)

  return (
    <div className="tn-inline-compare" style={{ "--ratio": ratio } as React.CSSProperties}>
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
    </div>
  )
}
