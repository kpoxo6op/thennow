import Link from "next/link"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        <h1 className="font-serif text-4xl tracking-tight">Page not found</h1>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-sm underline underline-offset-4"
        >
          All stories
        </Link>
      </main>
      <SiteFooter />
    </>
  )
}
