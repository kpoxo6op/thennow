"use client"

import { useRef } from "react"
import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

interface Props {
  href: string
  name: string
  thenSrc: string
  nowSrc: string
  sizes: string
  ratio: number
  // Equal zoom on both photographs, to lose a scan's torn edge while keeping them registered.
  trim?: number
  wide?: boolean
  priority?: boolean
  prefetch?: boolean
  // A title inside the link: the tile then needs no label of its own.
  caption?: React.ReactNode
  testId?: string
  onPointerEnter?: React.PointerEventHandler<HTMLAnchorElement>
}

// A resting cut through both photographs. It follows a mouse; touch and keyboard
// get the same cut at rest and the full comparison one tap away.
export function SeamTile({
  href,
  name,
  thenSrc,
  nowSrc,
  sizes,
  ratio,
  trim,
  wide,
  priority,
  prefetch,
  caption,
  testId,
  onPointerEnter,
}: Props) {
  const frameRef = useRef<HTMLSpanElement>(null)

  const setSeam = (seam: string) => {
    frameRef.current?.style.setProperty("--seam", seam)
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      data-testid={testId}
      aria-label={caption ? undefined : `${name}: compare then and now`}
      className="group block w-full"
      onPointerEnter={onPointerEnter}
      onPointerMove={(event) => {
        const frame = frameRef.current

        if (event.pointerType !== "mouse" || !frame) {
          return
        }

        const box = frame.getBoundingClientRect()
        setSeam(`${Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100))}%`)
      }}
      onPointerLeave={() => setSeam("50%")}
    >
      <span
        ref={frameRef}
        className={cn("tn-seam-tile relative block w-full overflow-hidden bg-muted", wide && "tn-seam-wide")}
        style={{ aspectRatio: ratio, "--trim": trim ?? 1.03 } as React.CSSProperties}
      >
        <Image src={nowSrc} alt="" fill sizes={sizes} priority={priority} className="object-cover" />
        <Image src={thenSrc} alt="" fill sizes={sizes} priority={priority} className="tn-seam-then object-cover" />
        <span aria-hidden className="tn-seam-line absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/90" />
      </span>
      {caption}
    </Link>
  )
}
