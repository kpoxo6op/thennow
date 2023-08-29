import * as React from "react"
import Link from "next/link"

import { NavItem } from "@/types/nav"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { BurgerMenu } from "@/components/burger-menu"

interface MainNavProps {
  items?: NavItem[]
}

export function MainNav({ items }: MainNavProps) {
  return (
    <>
      <div className="flex gap-6 border-2 border-yellow-500 px-2 md:gap-10">
        <Link href="/" className="items-center space-x-2 md:flex">
          <span className="font-bold sm:inline-block">{siteConfig.name}</span>
        </Link>
      </div>
      <BurgerMenu className="border-2 border-pink-400" />
    </>
  )
}
