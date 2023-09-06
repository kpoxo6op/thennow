//header.tsx
import { siteConfig } from "@/config/site"
import { MainNav } from "@/components/main-nav"
import * as React from "react"
import { cn } from "@/lib/utils"

const SiteHeader = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => {
    return (
      <header
        ref={ref}
        className={cn("container z-10 flex flex-col items-center gap-4 bg-background text-left", className)}
        {...props}
      >
        <div className="container flex h-16 items-center justify-between">
          <MainNav items={siteConfig.mainNav} />
        </div>
      </header>
    )
  }
)
SiteHeader.displayName = "SiteHeader"

export { SiteHeader }
