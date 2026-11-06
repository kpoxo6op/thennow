import Link from "next/link"

import { SiteHeader } from "@/components/site-header"

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="tn-enter flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-24 text-center">
        <h1 className="font-serif text-4xl tracking-tight">Not found</h1>
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          then|now
        </Link>
      </main>
    </>
  )
}
