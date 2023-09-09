import * as React from "react"
import Link from "next/link"

import { NavItem } from "@/types/nav"
import { cn } from "@/lib/utils"

// Define props for MainNav
interface MainNavProps {
  items?: NavItem[]
}

// Extend MainNavProps to define props for MobileMenu
interface MobileMenuProps
  extends React.HTMLAttributes<HTMLDivElement>,
    MainNavProps {}

// Define MobileMenu component
const MobileMenu = React.forwardRef<HTMLDivElement, MobileMenuProps>(
  ({ className, items, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "fixed left-0 top-16 h-full w-full bg-background",
          className
        )}
        {...props}
      >
        {items?.length
          ? items.map(
              (
                item,
                index // map through 'items' and display each one
              ) => (
                <div key={index}>
                  <div className="flex h-16 items-center justify-start ">
                    <div className="px-2 py-10 text-lg">
                      <Link className="hover:text-foreground/80" href={item.href}>{item.title}</Link>
                    </div>
                  </div>
                  <hr className="mx-2 border-secondary-foreground" />
                </div>
              )
            )
          : null}
      </div>
    )
  }
)

MobileMenu.displayName = "MobileMenu"

// Export the MobileMenu component
export { MobileMenu }
