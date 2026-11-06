//header.tsx
import * as React from "react"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { MainNav } from "@/components/main-nav"

interface SiteHeaderProps extends React.HTMLAttributes<HTMLElement> {
  story?: boolean
}

const SiteHeader = React.forwardRef<HTMLElement, SiteHeaderProps>(
  ({ className, story, ...props }, ref) => {
    return (
      <header
        ref={ref}
        data-testid="site-header"
        className={cn(
          "fixed inset-x-0 top-0 z-30 border-b border-border/70 bg-background text-left",
          className
        )}
        {...props}
      >
        <div className="flex h-14 w-full items-center justify-between px-4">
          <MainNav items={siteConfig.mainNav} story={story} />
        </div>
      </header>
    )
  }
)
SiteHeader.displayName = "SiteHeader"

export { SiteHeader }
