import Link from "next/link";

import { siteConfig } from "@/config/site"
import { MainNav } from "@/components/main-nav"


export function SiteFooter() {
  return (
    <footer className="container flex flex-col items-center gap-4 text-left">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <MainNav items={siteConfig.mainNav} />
      </div>
    </footer>
  )
}
