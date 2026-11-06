import { redirect } from "next/navigation"

// There are no contact details to publish yet; old links land on About.
export default function ContactPage() {
  redirect("/about")
}
