// Marketing layout in (marketing) route group

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <SiteHeader />
      <main className="tn-enter flex-1">{children}</main>
      <SiteFooter />
    </>
  )
}
