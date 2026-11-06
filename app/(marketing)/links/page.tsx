import Link from "next/link"

import { ResetScroll } from "@/components/reset-scroll"

export default async function LinksPage() {
  return (
    <article className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:py-14">
      <ResetScroll />
      <h1 className="font-serif text-5xl tracking-tight sm:text-6xl">Links</h1>
      <p className="font-serif text-xl sm:text-2xl">Coming soon...</p>
      <Link href="/places" className="inline-block py-2 font-serif text-xl underline underline-offset-4">
        See the places
      </Link>
    </article>
  )
}
