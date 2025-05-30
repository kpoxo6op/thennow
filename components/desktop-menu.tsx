"use client"

import Link from "next/link"

import { NavItem } from "@/types/nav"
import { cn } from "@/lib/utils"
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu"

interface DesktopMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  items: NavItem[]
}

export function DesktopMenu({ items, className, ...props }: DesktopMenuProps) {
  if (!items?.length) return null
  return (
    <NavigationMenu className={cn("hidden md:flex", className)} {...props}>
      <NavigationMenuList>
        {items.map((item) => (
          <NavigationMenuItem key={item.href}>
            <Link href={item.href} legacyBehavior passHref>
              <NavigationMenuLink className="px-3 py-2">{item.title}</NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
