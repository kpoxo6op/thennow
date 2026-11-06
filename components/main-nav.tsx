"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { NavItem } from "@/types/nav"
import { siteConfig } from "@/config/site"

interface MainNavProps {
  items?: NavItem[]
}

// Survives the header remounting between layouts.
let currentPath: string | null = null
let previousPath: string | null = null

export function MainNav({ items }: MainNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  React.useEffect(() => {
    if (pathname !== currentPath) {
      previousPath = currentPath
      currentPath = pathname
    }
  }, [pathname])

  const [before, after] = siteConfig.name.split("|")

  return (
    <>
      <Link
        href="/"
        className="-my-2 flex items-center py-2 font-serif text-xl tracking-tight"
        aria-label={siteConfig.name}
        onClick={(event) => {
          // Returning to the collection should land exactly where it was left.
          if (
            previousPath === "/" &&
            pathname !== "/" &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey
          ) {
            event.preventDefault()
            router.back()
          }
        }}
      >
        {before}
        <span aria-hidden className="mx-[0.2em] h-[1.05em] w-px bg-current" />
        {after}
      </Link>
      <nav className="flex items-center gap-5 sm:gap-7">
        {items?.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
            className="-my-3 py-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground sm:text-sm"
          >
            {item.title}
          </Link>
        ))}
      </nav>
    </>
  )
}
