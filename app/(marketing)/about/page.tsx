import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

export const metadata: Metadata = {
  title: "About",
}

export default async function AboutPage() {
  return (
    <>
      <h1 className="font-serif text-4xl tracking-tight">About</h1>
      <p className="mt-6 font-serif text-xl leading-relaxed sm:text-2xl">
        then|now is a visual archive of places photographed across time. Each
        story pairs an older image with a modern retake so visitors can see what
        stayed, what disappeared, and what the street looks like now.
      </p>
      <Link href="/historic-post-office" className="mt-10 block rounded-sm">
        <Image
          src="/posts/0002-historic-helensville-post-office/preview-post-2003x1241.jpg"
          alt="Historic Post Office, Helensville"
          width={2003}
          height={1241}
          sizes="(min-width: 768px) 720px, 100vw"
          className="w-full rounded-sm"
        />
      </Link>
      <p className="mt-8 max-w-prose leading-relaxed text-muted-foreground">
        This preview holds six stories and 300 sample places. The sample names
        and locations are fictional and reuse the same photographs, to show how
        the site behaves with a larger collection.
      </p>
    </>
  )
}
