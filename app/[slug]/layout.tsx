import { fontHomeSans, fontHomeSerif, fontReading } from "@/lib/fonts"
import { cn } from "@/lib/utils"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

interface RootLayoutProps {
  children: React.ReactNode
}

// Stories hang in the same dark room as the homepage.
export default function PostLayout({ children }: RootLayoutProps) {
  return (
    <div
      className={cn(
        "tn-home flex flex-1 flex-col font-sans",
        fontHomeSans.variable,
        fontHomeSerif.variable,
        fontReading.variable
      )}
    >
      <SiteHeader />
      {children}
      <SiteFooter className="text-sm" />
    </div>
  )
}
