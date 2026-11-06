import Link from "next/link"

import { SiteHeader } from "@/components/site-header"

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="tn-enter flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-24 text-center">
        <h1 className="font-serif text-5xl tracking-tight">Not found</h1>
        <Link href="/places" className="py-2 font-serif text-xl underline underline-offset-4">
          See the places
        </Link>
      </main>
    </>
  )
}
