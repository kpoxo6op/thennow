import * as React from "react"
import Link from "next/link"

import { NavItem } from "@/types/nav"
import { cn } from "@/lib/utils"

interface MobileMenuProps extends React.HTMLAttributes<HTMLElement> {
  items?: NavItem[]
  pathname?: string
}

const MobileMenu = React.forwardRef<HTMLElement, MobileMenuProps>(
  ({ className, items, pathname, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        className={cn(
          "fixed inset-x-0 bottom-0 top-14 overflow-y-auto bg-background px-4 pt-4 md:hidden",
          className
        )}
        {...props}
      >
        {items?.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
            className="flex h-14 items-center rounded-sm font-serif text-2xl aria-[current=page]:text-muted-foreground"
          >
            {item.title}
          </Link>
        ))}
      </nav>
    )
  }
)

MobileMenu.displayName = "MobileMenu"

export { MobileMenu }
