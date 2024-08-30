import * as React from "react"
import Link from "next/link"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { MainNav } from "@/components/main-nav"

const SiteFooter = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => {
  return (
    <footer
      ref={ref}
      className={cn(
        "container flex flex-col items-center gap-4 text-left",
        className
      )}
      {...props}
    >
      <div className="flex h-16 items-center space-x-4 text-center sm:justify-between sm:space-x-0">
        {siteConfig.name}
      </div>
    </footer>
  )
})
SiteFooter.displayName = "SiteFooter"

export { SiteFooter }
