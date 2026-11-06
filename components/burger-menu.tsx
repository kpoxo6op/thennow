//header.tsx
import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Icons } from "@/components/icons"

interface BurgerMenuProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  open?: boolean
}

const BurgerMenu = React.forwardRef<HTMLButtonElement, BurgerMenuProps>(
  ({ className, open, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        aria-expanded={open}
        aria-label="Menu"
        className={cn(
          "flex size-11 items-center justify-center rounded-sm",
          className
        )}
        {...props}
      >
        {open ? <X aria-hidden /> : <Icons.menu aria-hidden />}
      </button>
    )
  }
)
BurgerMenu.displayName = "BurgerMenu"

export { BurgerMenu }
