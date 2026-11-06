"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { NavItem } from "@/types/nav"
import { siteConfig } from "@/config/site"
import { consumeStoryOrigin, SHOW_ALL_STORIES_EVENT } from "@/lib/story-return"
import { MobileMenu } from "@/components/MobileMenu"
import { BurgerMenu } from "@/components/burger-menu"
import { DesktopMenu } from "@/components/desktop-menu"

interface MainNavProps {
  items?: NavItem[]
  story?: boolean
}

export function MainNav({ items, story }: MainNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuPath, setMenuPath] = React.useState<string | null>(null)
  const burgerRef = React.useRef<HTMLButtonElement>(null)
  const showMobileMenu = menuPath === pathname

  React.useEffect(() => {
    if (!showMobileMenu) {
      return
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuPath(null)
        burgerRef.current?.focus()
      }
    }
    const closeOnDesktop = window.matchMedia("(min-width: 768px)")
    const close = () => setMenuPath(null)

    document.addEventListener("keydown", closeOnEscape)
    closeOnDesktop.addEventListener("change", close)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", closeOnEscape)
      closeOnDesktop.removeEventListener("change", close)
      document.body.style.overflow = ""
    }
  }, [showMobileMenu])

  return (
    <>
      <Link
        href="/"
        aria-label={story ? "Back to all stories" : siteConfig.name}
        className="-my-1 flex h-11 items-center rounded-sm font-bold"
        onClick={(event) => {
          setMenuPath(null)

          if (event.metaKey || event.ctrlKey || event.shiftKey) {
            return
          }

          if (pathname === "/") {
            // Already home: reset the view in place rather than stack history.
            event.preventDefault()
            window.dispatchEvent(new Event(SHOW_ALL_STORIES_EVENT))
          } else if (story && consumeStoryOrigin(pathname.slice(1))) {
            event.preventDefault()
            router.back()
          }
        }}
      >
        {story && <ChevronLeft aria-hidden className="-ml-1 mr-0.5 size-5" />}
        {siteConfig.name}
      </Link>
      <DesktopMenu items={items} pathname={pathname} />
      <BurgerMenu
        ref={burgerRef}
        open={showMobileMenu}
        aria-controls="mobile-menu"
        onClick={() => setMenuPath(showMobileMenu ? null : pathname)}
        className="-mr-2.5 md:hidden"
      />
      {showMobileMenu && items && (
        <MobileMenu
          id="mobile-menu"
          className="animate-in fade-in duration-150"
          items={items}
          pathname={pathname}
        />
      )}
    </>
  )
}
