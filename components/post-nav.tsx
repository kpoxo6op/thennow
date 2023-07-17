import * as React from "react"

import { cn } from "@/lib/utils"

interface PostNavProps extends React.HTMLAttributes<HTMLDivElement> { }

// add meta?

export const PostNav = React.forwardRef<HTMLDivElement, PostNavProps>(({ className, ...props }, ref) => {
  return (
    <header
      ref={ref}
      className={cn("sticky top-0 w-full items-center", className)}
      {...props}
    >
      <div className="container flex flex-col items-center gap-4 text-left">
        <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0"></div>
      </div>
    </header>
  )
})

PostNav.displayName = "PostNav";
