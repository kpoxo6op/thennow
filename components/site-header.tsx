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
        data-testid="site-header"
        className={cn("fixed inset-x-0 top-0 z-10 bg-background/0 text-left", className)}
        {...props}
      >
        <div className="flex h-16 w-full items-center justify-between px-2">
          <MainNav items={siteConfig.mainNav} />
        </div>
      </header>
    )
  }
)
SiteHeader.displayName = "SiteHeader"

export { SiteHeader }
