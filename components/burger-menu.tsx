//header.tsx
import * as React from "react"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { Icons } from "@/components/icons"

const BurgerMenu = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div ref={ref} className={cn("", className)} {...props}>
      <Icons.menu className="" />
    </div>
  )
})
BurgerMenu.displayName = "BurgerMenu"

export { BurgerMenu }
