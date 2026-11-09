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

  // Heading back to the page just left should land where it was left:
  // same filters, same map, same scroll.
  const returnIfJustLeft =
    (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (
        previousPath === href &&
        pathname !== href &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey
      ) {
        event.preventDefault()
        router.back()
      }
    }

  const [before, after] = siteConfig.name.split("|")

  return (
    <>
      <Link
        href="/"
        className="-my-2 flex items-center py-2 font-serif text-[1.375rem] tracking-tight"
        aria-label={siteConfig.name}
        onClick={returnIfJustLeft("/")}
      >
        {before}
        <span aria-hidden className="mx-[0.2em] h-[1.05em] w-0.5 bg-accent" />
        {after}
      </Link>
      <nav className="flex items-center gap-3 sm:gap-6">
        {items?.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
            onClick={returnIfJustLeft(item.href)}
            className="-my-3 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-accent aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-[6px]"
          >
            {item.title}
          </Link>
        ))}
      </nav>
    </>
  )
}
