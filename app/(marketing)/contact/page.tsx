import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact",
}

export default async function ContactPage() {
  return (
    <>
      <h1 className="font-serif text-4xl tracking-tight">Contact</h1>
      <p className="mt-6 text-muted-foreground">Coming soon...</p>
    </>
  )
}
