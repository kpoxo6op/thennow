import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Links",
}

export default async function LinksPage() {
  return (
    <>
      <h1 className="font-serif text-4xl tracking-tight">Links</h1>
      <p className="mt-6 text-muted-foreground">Coming soon...</p>
    </>
  )
}
