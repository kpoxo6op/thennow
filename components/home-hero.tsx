"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowDown } from "lucide-react"

import type PostType from "@/interfaces/post"
import { CompareFrame } from "@/components/compare-frame"

const SWEEP_DELAY_MS = 900
const SWEEP_DURATION_MS = 2600
const SWEEP_REACH = 22

export function HomeHero({ post }: { post: PostType }) {
  const [position, setPosition] = React.useState(50)
  const sweepRef = React.useRef<(() => void) | null>(null)

  // One slow pass of the line shows that the photograph can be moved.
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    let frame = 0
    const timer = window.setTimeout(() => {
      const start = performance.now()
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / SWEEP_DURATION_MS)
        setPosition(
          50 - Math.sin(progress * Math.PI * 2) * SWEEP_REACH * (1 - progress * 0.3)
        )
        if (progress < 1) {
          frame = requestAnimationFrame(step)
        } else {
          setPosition(50)
        }
      }
      frame = requestAnimationFrame(step)
    }, SWEEP_DELAY_MS)

    const stop = () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
    sweepRef.current = stop

    return stop
  }, [])

  const stopSweep = () => sweepRef.current?.()

  return (
    <section aria-labelledby="home-title">
      <div className="flex flex-col gap-x-10 gap-y-2 px-4 pb-4 pt-5 lg:flex-row lg:items-end lg:justify-between lg:pb-5 lg:pt-6">
        <h1
          id="home-title"
          className="text-balance font-serif text-[2.125rem] leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
        >
          New Zealand Then and Now
        </h1>
        <p className="max-w-sm text-pretty text-foreground/75 lg:pb-1 lg:text-right">
          The same places, photographed across time. Drag the line to see what
          changed.
        </p>
      </div>
      <div onPointerDownCapture={stopSweep} onKeyDownCapture={stopSweep}>
        <CompareFrame
          post={post}
          position={position}
          onPositionChange={setPosition}
          sizes="100vw"
          variant="hero"
        />
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-2">
        <Link
          href={`/${post.slug}`}
          className="flex min-h-11 items-center rounded-sm text-sm text-foreground/75 underline-offset-4 hover:text-foreground hover:underline"
        >
          {post.name}
        </Link>
        <Link
          href="/#places"
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-sm text-sm font-medium"
        >
          Find a place
          <ArrowDown aria-hidden className="size-4" />
        </Link>
      </div>
    </section>
  )
}
