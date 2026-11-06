import Link from "next/link"
import type PostType from "@/interfaces/post"

import { ArrowRight } from "lucide-react"

import { fetchPending, fetchPosts, toPendingSummary } from "@/lib/api"
import { placesHref } from "@/lib/places"
import { SOURCE_LINE, toSections } from "@/components/Desc"
import { CtaLink } from "@/components/cta-link"
import { HomeHero } from "@/components/home-hero"
import { PendingTile } from "@/components/pending-tile"
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
  const pending = await fetchPending()
  const hero = posts.find((post) => post.slug === HERO_SLUG) ?? posts[0]
  const originals = posts.filter((post) => !post.sample)
  const rest = originals.filter((post) => post !== hero)
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
                className="block py-3 text-[15px] leading-snug md:py-2.5 md:text-base"
              >
                <span className="underline underline-offset-4">{hero.name}</span>
                <ArrowRight aria-hidden className="ml-1.5 inline size-4 align-[-0.15em]" />
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
            {rest.map((story, index) => (
              <li
                key={story.slug}
                className={index === 0 ? "sm:col-span-2 lg:col-span-6" : index === 1 ? "lg:col-span-6" : "lg:col-span-4"}
              >
                <StoryTile story={story} sizes={index < 2 ? "(min-width: 640px) 50vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"} />
              </li>
            ))}
          </ul>

          {pending.length > 0 ? (
            <div data-testid="home-pending" className="mt-14 border-t pt-4 md:mt-20 md:pt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
                <h2 className="font-serif text-3xl leading-none md:text-4xl">Photographed once, so far.</h2>
                <p className="text-muted-foreground">Archive photographs whose modern photographs are pending.</p>
              </div>
              <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 md:mt-6 md:gap-x-6 lg:grid-cols-4">
                {pending.map((place) => (
                  <li key={place.slug}>
                    <PendingTile place={toPendingSummary(place)} sizes="(min-width: 1024px) 25vw, 50vw" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
