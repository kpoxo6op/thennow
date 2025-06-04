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
}

const DesktopMenu = React.forwardRef<HTMLDivElement, DesktopMenuProps>(
  ({ items, className }, ref) => {
    if (!items?.length) return null
    return (
      <NavigationMenu ref={ref} className={cn("hidden md:block", className)}>
        <NavigationMenuList className="flex gap-6">
          {items.map((item) => (
            <NavigationMenuItem key={item.href}>
              <Link href={item.href} legacyBehavior passHref>
                <NavigationMenuLink className="px-2 py-1 text-sm font-medium hover:text-foreground/80">
                  {item.title}
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    )
  }
)
DesktopMenu.displayName = "DesktopMenu"

export { DesktopMenu }
