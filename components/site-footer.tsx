import * as React from "react"

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
        "mt-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t px-4 py-5 text-xs text-muted-foreground",
        className
      )}
      {...props}
    >
      <span className="ml-auto flex items-center gap-4">
        <a href="/feed.xml" className="-my-2 py-2 underline underline-offset-2">
          RSS
        </a>
        <span>Version {appVersion}</span>
      </span>
    </footer>
  )
})
SiteFooter.displayName = "SiteFooter"

export { SiteFooter }
