import { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Links",
}

export default async function LinksPage() {
  return (
    <>
      <h1 className="font-serif text-4xl tracking-tight">Links</h1>
      <p className="mt-6 text-muted-foreground">Coming soon...</p>
      <Link
        href="/#places"
        className="mt-4 inline-flex h-11 items-center rounded-sm underline underline-offset-4"
      >
        All places
      </Link>
    </>
  )
}
