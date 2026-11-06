//header.tsx
import * as React from "react"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { MainNav } from "@/components/main-nav"

const SiteHeader = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => {
  return (
    <header
      ref={ref}
      data-testid="site-header"
      className={cn(
        "inset-x-0 top-0 z-10 bg-background text-left md:sticky",
        className
      )}
      {...props}
    >
      <div className="flex h-14 w-full items-center justify-between px-4">
        <MainNav items={siteConfig.mainNav} />
      </div>
    </header>
  )
})
SiteHeader.displayName = "SiteHeader"

export { SiteHeader }
