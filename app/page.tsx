import Link from "next/link"
import type PostType from "@/interfaces/post"

import { ArrowRight } from "lucide-react"

import { fetchPosts } from "@/lib/api"
import { placesHref } from "@/lib/places"
import { SOURCE_LINE, toSections } from "@/components/Desc"
import { CtaLink } from "@/components/cta-link"
import { HomeHero } from "@/components/home-hero"
import { StoryTile } from "@/components/story-tile"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

const HERO_SLUG = "sheep"

// Dated, written sections only: several stories are still "Coming soon...".
function datedSections(story: PostType) {
  return toSections(story.description)
    .filter((section) => section.year)
    .map((section) => ({
      year: section.year as string,
      lines: section.lines.filter((line) => !SOURCE_LINE.test(line)),
    }))
}

export default async function IndexPage() {
  const posts = await fetchPosts()
  const hero = posts.find((post) => post.slug === HERO_SLUG) ?? posts[0]
  const originals = posts.filter((post) => !post.sample)
  const heroSections = datedSections(hero)
  const thenYear = heroSections[0]?.year
  const nowYear = heroSections[heroSections.length - 1]?.year
  return (
    <>
      <SiteHeader />
      <main className="tn-enter flex-1">
        <section>
          <HomeHero
            name={hero.name}
            thenSrc={hero.b_imageUrl}
            nowSrc={hero.a_imageUrl}
            ratio={hero.w / hero.h}
            thenYear={thenYear}
            nowYear={nowYear}
            caption={
              <Link
                href={`/${hero.slug}`}
                className="inline-flex min-h-11 items-center gap-2 text-[15px] underline underline-offset-4 md:text-base"
              >
                {hero.name}
                <ArrowRight aria-hidden className="size-4 shrink-0" />
              </Link>
            }
          />
          <div className="flex flex-col gap-4 px-4 pb-6 pt-2 md:min-h-[var(--hero-band-h)] md:flex-row md:items-center md:gap-12 md:py-0">
            <h1 className="text-balance font-serif text-[2.125rem] leading-[1.04] min-[360px]:text-[2.4rem] md:text-[clamp(2.5rem,4.25vw,5.25rem)]">
              <span className="md:block">The same corner, </span>
              <span className="md:block">
                ninety<span className="mx-[-0.05em]">-</span>three years apart.
              </span>
            </h1>
            <div className="flex flex-col gap-3 md:w-[20rem] md:shrink-0 md:items-start lg:w-[26rem]">
              <p className="text-[17px] leading-snug text-muted-foreground">
                Old photographs of New Zealand places, each paired with a modern retake.
              </p>
              <CtaLink href="/places" className="w-full md:w-auto">
                Explore the places
              </CtaLink>
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 md:pb-28">
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-t pt-4 md:pt-5">
            <h2 className="font-serif text-3xl leading-none md:text-4xl">Photographed twice.</h2>
            <Link href={placesHref({ view: "map" })} className="-my-1 py-1 underline underline-offset-4">
              Look around the map
            </Link>
          </div>

          <ul className="mt-5 grid grid-cols-1 gap-x-3 gap-y-8 sm:grid-cols-2 md:mt-6 md:gap-x-6 md:gap-y-12 lg:grid-cols-12">
            {originals.map((story, index) => (
              <li
                key={story.slug}
                className={index < 2 ? "lg:col-span-6" : "lg:col-span-3"}
              >
                <StoryTile story={story} sizes={index < 2 ? "(min-width: 640px) 50vw, 100vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"} />
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
