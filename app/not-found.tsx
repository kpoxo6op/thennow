import { Metadata } from "next"

import { CtaLink } from "@/components/cta-link"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
  title: "Not found",
}

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="tn-enter flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-24 text-center">
        <h1 className="font-serif text-6xl leading-none md:text-8xl">Not found</h1>
        <CtaLink href="/places">Explore the places</CtaLink>
      </main>
      <SiteFooter />
    </>
  )
}
