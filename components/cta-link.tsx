import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"

// The site's one way of saying "go on from here".
export function CtaLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-6 font-medium text-background transition-opacity hover:opacity-85",
        className
      )}
    >
      {children}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  )
}
