import * as React from "react"

import { cn } from "@/lib/utils"
import { appVersion } from "@/lib/version"

interface SiteFooterProps extends React.HTMLAttributes<HTMLElement> {
  note?: string
}

const SiteFooter = React.forwardRef<HTMLElement, SiteFooterProps>(
  ({ className, note, ...props }, ref) => {
    return (
      <footer
        ref={ref}
        className={cn(
          "mt-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-6 text-xs text-muted-foreground",
          className
        )}
        {...props}
      >
        <span>{note}</span>
        <span>Version {appVersion}</span>
      </footer>
    )
  }
)
SiteFooter.displayName = "SiteFooter"

export { SiteFooter }
