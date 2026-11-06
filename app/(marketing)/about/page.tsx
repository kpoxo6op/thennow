import Image from "next/image"
import Link from "next/link"

import { fetchPosts } from "@/lib/api"
import { SOURCE_LINE } from "@/components/Desc"
import { ResetScroll } from "@/components/reset-scroll"

export default async function AboutPage() {
  const posts = await fetchPosts()
  const sources = posts.flatMap((post) =>
    post.description
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => SOURCE_LINE.test(line))
      .map((source) => ({ source, slug: post.slug, name: post.name }))
  )

  return (
    <article className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:py-14">
      <ResetScroll />
      <h1 className="font-serif text-5xl tracking-tight sm:text-6xl">About</h1>
      <Image
        src="/posts/0002-historic-helensville-post-office/preview-post-2003x1241.jpg"
        alt="The Helensville post office street, photographed in 1920 and in 2023, side by side"
        width={2003}
        height={1241}
        priority
        sizes="(min-width: 768px) 48rem, 100vw"
        className="w-full bg-muted"
      />
      <p className="font-serif text-xl leading-relaxed sm:text-2xl">
        then|now is a visual archive of places photographed across time. Each
        story pairs an older image with a modern retake so visitors can see what
        stayed, what disappeared, and what the street looks like now.
      </p>
      <p className="text-muted-foreground">
        This preview holds six original stories and 300 sample places. The
        sample places are fictional Auckland-area locations that repeat the
        project&apos;s photographs as placeholders; those photographs do not
        show them.
      </p>
      <section id="sources" className="scroll-mt-20 space-y-3 border-t pt-4">
        <h2 className="font-serif text-3xl tracking-tight">Sources</h2>
        <ul className="space-y-4">
          {sources.map(({ source, slug, name }) => (
            <li key={source}>
              <Link href={`/${slug}`} className="font-serif text-xl underline-offset-4 hover:underline">
                {name}
              </Link>
              <a
                href={`https://${source}`}
                target="_blank"
                rel="noreferrer"
                className="block break-words py-1 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                {source}
              </a>
            </li>
          ))}
        </ul>
      </section>
      <Link href="/places" className="inline-block py-2 font-serif text-xl underline underline-offset-4">
        See the places
      </Link>
    </article>
  )
}
