'use client'

import * as React from "react"
import Link from "next/link"

import { NavItem } from "@/types/nav"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { Dropdown } from "@/components/Dropdown"
import { BurgerMenu } from "@/components/burger-menu"

interface MainNavProps {
  items?: NavItem[]
}

export function MainNav({ items }: MainNavProps) {
  const [showDropdown, setShowDropdown] = React.useState(false)

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown)
  }
  return (
    <>
      <div className="flex gap-6 px-2 md:gap-10">
        <Link href="/" className="items-center space-x-2 md:flex">
          <span className="font-bold sm:inline-block">{siteConfig.name}</span>
        </Link>
      </div>
      <BurgerMenu
        onClick={toggleDropdown}
        className="px-2 md:hidden"
      />
      <Dropdown show={showDropdown} />
    </>
  )
}
