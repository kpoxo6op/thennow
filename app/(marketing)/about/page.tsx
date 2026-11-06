import { Metadata } from "next"
import Link from "next/link"

import { fetchPosts } from "@/lib/api"
import { CtaLink } from "@/components/cta-link"
import { InlineCompare } from "@/components/inline-compare"
import { SOURCE_LINE } from "@/components/Desc"
import { ResetScroll } from "@/components/reset-scroll"

const FEATURE_SLUG = "historic-post-office"

export const metadata: Metadata = {
  title: "About",
}

export default async function AboutPage() {
  const posts = await fetchPosts()
  const feature = posts.find((post) => post.slug === FEATURE_SLUG) ?? posts[0]
  const sources = posts.flatMap((post) =>
    post.description
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => SOURCE_LINE.test(line))
      .map((source) => ({ source, slug: post.slug, name: post.name }))
  )

  return (
    <article className="px-4 pb-16 pt-8 md:pb-24 md:pt-14">
      <ResetScroll />
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        <h1 className="font-serif text-6xl leading-none md:text-8xl">About</h1>
        <div className="max-w-2xl space-y-4">
          <p className="font-serif text-[2rem] leading-[1.1] md:text-[2.75rem]">
            then|now is a visual archive of places photographed across time.
          </p>
          <p className="tn-reading text-lg leading-relaxed md:text-xl md:leading-relaxed">
            Each story pairs an older image with a modern retake so visitors can see what stayed,
            what disappeared, and what the street looks like now.
          </p>
        </div>
      </div>

      <figure className="mt-10 md:mt-16">
        <InlineCompare
          name={feature.name}
          thenSrc={feature.b_imageUrl}
          nowSrc={feature.a_imageUrl}
          ratio={feature.w / feature.h}
          priority
        />
        <figcaption className="mt-2 text-sm">
          <Link href={`/${feature.slug}`} className="underline underline-offset-4">
            {feature.name}
          </Link>
        </figcaption>
      </figure>

      <section id="sources" className="mt-14 grid scroll-mt-20 gap-6 border-t pt-6 md:mt-20 lg:grid-cols-2 lg:gap-10">
        <h2 className="font-serif text-5xl leading-none md:text-7xl">Sources</h2>
        <ul>
          {sources.map(({ source, slug, name }) => {
            const slash = source.indexOf("/")
            const host = slash === -1 ? source : source.slice(0, slash)
            const path = slash === -1 ? "" : source.slice(slash)

            return (
              <li key={source} className="space-y-1 border-b py-4 first:border-t">
                <Link href={`/${slug}`} className="block text-lg font-medium leading-snug underline-offset-4 hover:underline">
                  {name}
                </Link>
                <a
                  href={`https://${source}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-[15px] leading-snug text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  <span className="text-foreground">{host}</span>
                  <span className="text-[0px]">{path}</span>
                </a>
              </li>
            )
          })}
        </ul>
      </section>

      <CtaLink href="/places" className="mt-12 w-full md:w-auto lg:ml-[calc(50%+1.25rem)]">
        Explore the places
      </CtaLink>
    </article>
  )
}
