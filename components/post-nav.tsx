import * as React from "react"

import Link from "next/link"
import { ArrowLeft } from 'lucide-react';
import { cn } from "@/lib/utils"
import BackButton from "./back-button";

interface PostNavProps extends React.HTMLAttributes<HTMLDivElement> { }

// add meta?

export const PostNav = React.forwardRef<HTMLDivElement, PostNavProps>(({ className, ...props }, ref) => {
  return (
    <header
      ref={ref}
      className={cn("sticky top-0 w-full items-center", className)}
      {...props}
    >
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <div className="flex gap-6 px-2 md:gap-10">
          {/* <Link href="/" className="flex space-x-2">
            <ArrowLeft />
          </Link> */}
          <BackButton />
        </div>
      </div>
    </header>
  )
})

PostNav.displayName = "PostNav";
