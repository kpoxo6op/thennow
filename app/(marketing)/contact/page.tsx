import { redirect } from "next/navigation"

// There are no contact details to publish yet; the address stays alive.
export default function ContactPage() {
  redirect("/about")
}
