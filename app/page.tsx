import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { fetchHomeStories, fetchPending, toPendingSummary } from "@/lib/api"
import { PENDING_HEADING } from "@/lib/places"
import { toSections } from "@/components/Desc"
import { HomeHero } from "@/components/home-hero"
import { PendingTile } from "@/components/pending-tile"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { StoryTile } from "@/components/story-tile"

export const metadata: Metadata = {
  alternates: { canonical: "/", types: { "application/rss+xml": "/feed.xml" } },
}

export default async function IndexPage() {
  const [hero, ...rest] = await fetchHomeStories()
  const pending = await fetchPending()
  const dated = toSections(hero.description).filter((section) => section.year)
  const thenYear = dated[0]?.year
  const nowYear = dated.length > 1 ? dated.at(-1)?.year : undefined
  const yearsApart = Number(nowYear) - Number(thenYear)
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
                <span className="underline underline-offset-4">
                  {hero.name}
                </span>
                <ArrowRight
                  aria-hidden
                  className="ml-1.5 inline size-4 align-[-0.15em]"
                />
              </Link>
            }
          />
          <div className="flex flex-col gap-4 px-4 pb-6 pt-2 md:min-h-[var(--hero-band-h)] md:flex-row md:items-center md:gap-12 md:py-0">
            <h1 className="text-balance font-serif text-[2.125rem] leading-[1.04] min-[360px]:text-[2.4rem] md:text-[clamp(2.5rem,4.25vw,5.25rem)]">
              <span className="md:block">The same place, </span>
              <span className="md:block">
                {yearsApart > 0
                  ? `${yearsApart} ${yearsApart === 1 ? "year" : "years"} apart.`
                  : "photographed again."}
              </span>
            </h1>
            <p className="text-[17px] leading-snug text-muted-foreground md:w-[20rem] md:shrink-0 lg:w-[26rem]">
              Old photographs of New Zealand places, paired with modern retakes.
            </p>
          </div>
        </section>

        <section className="px-4 pb-20 md:pb-28 md:pt-5">
          <ul className="grid grid-cols-1 gap-x-3 gap-y-8 sm:grid-cols-2 md:gap-x-6 md:gap-y-12 lg:grid-cols-12">
            {rest.map((story, index) => (
              <li
                key={story.slug}
                className={
                  index === 0
                    ? "sm:col-span-2 lg:col-span-6"
                    : index === 1
                      ? "lg:col-span-6"
                      : "lg:col-span-4"
                }
              >
                <StoryTile
                  story={story}
                  sizes={
                    index < 2
                      ? "(min-width: 640px) 50vw, 100vw"
                      : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  }
                />
              </li>
            ))}
          </ul>

          {pending.length > 0 ? (
            <div
              data-testid="home-pending"
              className="mt-14 border-t pt-4 md:mt-20 md:pt-5"
            >
              <h2 className="font-serif text-3xl leading-none md:text-4xl">
                {PENDING_HEADING}
              </h2>
              <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 md:mt-6 md:gap-x-6 lg:grid-cols-4">
                {pending.map((place) => (
                  <li key={place.slug}>
                    <PendingTile
                      place={toPendingSummary(place)}
                      sizes="(min-width: 1024px) 25vw, 50vw"
                    />
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
