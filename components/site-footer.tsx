import * as React from "react"
import Link from "next/link"

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
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-border/70 px-4 py-3 text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      <nav aria-label="Secondary">
        <ul className="flex gap-5">
          {siteConfig.footerNav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex h-11 items-center rounded-sm hover:text-foreground"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <span>
        {siteConfig.name} · Version {appVersion}
      </span>
    </footer>
  )
})
SiteFooter.displayName = "SiteFooter"

export { SiteFooter }
