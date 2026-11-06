import * as React from "react"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { appVersion } from "@/lib/version"

const SiteFooter = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => {
  return (
    <footer
      ref={ref}
      className={cn(
        "flex items-center justify-between gap-4 border-t border-border/70 px-4 py-5 text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      <span>{siteConfig.name}</span>
      <span>Version {appVersion}</span>
    </footer>
  )
})
SiteFooter.displayName = "SiteFooter"

export { SiteFooter }
