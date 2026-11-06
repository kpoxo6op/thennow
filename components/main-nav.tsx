"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { NavItem } from "@/types/nav"
import { siteConfig } from "@/config/site"
import {
  consumeStoryOrigin,
  forgetStoryOriginUnless,
  SHOW_ALL_STORIES_EVENT,
} from "@/lib/story-return"

interface MainNavProps {
  items?: NavItem[]
  story?: boolean
}

export function MainNav({ items, story }: MainNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  React.useEffect(() => {
    if (story) {
      forgetStoryOriginUnless(pathname.slice(1))
    }
  }, [story, pathname])

  return (
    <>
      <Link
        href="/"
        aria-label={story ? "Back to all places" : siteConfig.name}
        className="flex h-11 items-center rounded-sm font-serif text-xl font-medium tracking-tight"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey) {
            return
          }

          if (pathname === "/") {
            // Already home: reset in place rather than stack history.
            event.preventDefault()
            window.dispatchEvent(new Event(SHOW_ALL_STORIES_EVENT))
          } else if (story) {
            event.preventDefault()

            if (consumeStoryOrigin(pathname.slice(1))) {
              router.back()
            } else {
              router.push("/#places")
            }
          }
        }}
      >
        {story && <ChevronLeft aria-hidden className="-ml-1 mr-0.5 size-5" />}
        {siteConfig.name}
      </Link>
      <nav aria-label="Main">
        <ul className="flex gap-5 sm:gap-7">
          {items?.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className="flex h-11 items-center rounded-sm text-sm text-foreground/75 transition-colors hover:text-foreground aria-[current=page]:text-foreground"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
