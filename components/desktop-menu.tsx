import * as React from "react"
import Link from "next/link"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuLink,
} from "@radix-ui/react-navigation-menu"

import { NavItem } from "@/types/nav"
import { cn } from "@/lib/utils"

interface DesktopMenuProps {
  items?: NavItem[]
  className?: string
  pathname?: string
}

const DesktopMenu = React.forwardRef<HTMLDivElement, DesktopMenuProps>(
  ({ items, className, pathname }, ref) => {
    if (!items?.length) return null
    return (
      <NavigationMenu ref={ref} className={cn("hidden md:block", className)}>
        <NavigationMenuList className="flex gap-7">
          {items.map((item) => (
            <NavigationMenuItem key={item.href}>
              <NavigationMenuLink asChild>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className="flex h-11 items-center rounded-sm text-sm text-foreground/75 transition-colors hover:text-foreground aria-[current=page]:text-foreground"
                >
                  {item.title}
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    )
  }
)
DesktopMenu.displayName = "DesktopMenu"

export { DesktopMenu }
