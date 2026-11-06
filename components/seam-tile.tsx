"use client"

import { useRef } from "react"
import Image from "next/image"
import Link from "next/link"

interface Props {
  href: string
  name: string
  thenSrc: string
  nowSrc: string
  sizes: string
  ratio: number
}

// A resting cut through both photographs. It follows a mouse; touch and keyboard
// get the same cut at rest and the full comparison one tap away.
export function SeamTile({ href, name, thenSrc, nowSrc, sizes, ratio }: Props) {
  const tileRef = useRef<HTMLAnchorElement>(null)

  const setSeam = (seam: string) => {
    tileRef.current?.style.setProperty("--seam", seam)
  }

  return (
    <Link
      ref={tileRef}
      href={href}
      aria-label={`${name}: compare then and now`}
      className="tn-seam-tile relative block w-full overflow-hidden bg-muted"
      style={{ aspectRatio: ratio }}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") {
          return
        }

        const box = event.currentTarget.getBoundingClientRect()
        setSeam(`${((event.clientX - box.left) / box.width) * 100}%`)
      }}
      onPointerLeave={() => setSeam("50%")}
    >
      <Image src={nowSrc} alt="" fill sizes={sizes} className="object-cover" />
      <Image src={thenSrc} alt="" fill sizes={sizes} className="tn-seam-then object-cover" />
      <span aria-hidden className="tn-seam-line absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/90" />
    </Link>
  )
}
