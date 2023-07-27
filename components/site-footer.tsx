import Link from "next/link";
import { siteConfig } from "@/config/site"
import { MainNav } from "@/components/main-nav"
import * as React from "react"
import { cn } from "@/lib/utils"

const SiteFooter = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => {
    return (
      <footer
        ref={ref}
        className={cn("container flex flex-col items-center gap-4 text-left", className)}
        {...props}
      >
        <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
          <MainNav items={siteConfig.mainNav} />
        </div>
      </footer>
    )
  }
)
SiteFooter.displayName = "SiteFooter"

export { SiteFooter }
