import Form from "next/form"
import Link from "next/link"
import { Search } from "lucide-react"
import type PostType from "@/interfaces/post"

import { fetchPosts } from "@/lib/api"
import { placesHref, STORY_TRIM } from "@/lib/places"
import { SOURCE_LINE, toSections } from "@/components/Desc"
import { CtaLink } from "@/components/cta-link"
import { HomeHero } from "@/components/home-hero"
import { SeamTile } from "@/components/seam-tile"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

const HERO_SLUG = "sheep"
const LEAD_SLUG = "historic-post-office"

// Dated, written sections only: several stories are still "Coming soon...".
function datedSections(story: PostType) {
  return toSections(story.description)
    .filter((section) => section.year)
    .map((section) => ({
      year: section.year as string,
      lines: section.lines.filter((line) => !SOURCE_LINE.test(line)),
    }))
}

const STORY_TITLE = "block py-1 text-xl font-medium leading-snug underline-offset-4 hover:underline"

function StoryRow({ stories }: { stories: PostType[] }) {
  return (
    <div className="flex flex-col gap-10 md:flex-row md:gap-6">
      {stories.map((story) => (
        <figure key={story.slug} className="min-w-0" style={{ flex: `${story.w / story.h} 1 0%` }}>
          <SeamTile
            href={`/${story.slug}`}
            name={story.name}
            thenSrc={story.b_imageUrl}
            nowSrc={story.a_imageUrl}
            ratio={story.w / story.h}
            trim={STORY_TRIM[story.slug]}
            sizes="(min-width: 768px) 50vw, 100vw"
          />
          <figcaption className="mt-2">
            <Link href={`/${story.slug}`} className={STORY_TITLE}>
              {story.name}
            </Link>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

export default async function IndexPage() {
  const posts = await fetchPosts()
  const hero = posts.find((post) => post.slug === HERO_SLUG) ?? posts[0]
  const originals = posts.filter((post) => !post.sample)
  const lead = originals.find((post) => post.slug === LEAD_SLUG) ?? originals[0]
  const rest = originals.filter((post) => post !== hero && post !== lead)
  const heroSections = datedSections(hero)
  const thenYear = heroSections[0]?.year
  const nowYear = heroSections[heroSections.length - 1]?.year
  const leadSections = datedSections(lead)
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
              <Link href={`/${hero.slug}`} className="-my-1 py-1 underline underline-offset-4">
                {hero.name}
              </Link>
            }
          >
            <h1 className="text-balance px-4 pb-2 pt-3 font-serif text-[2.4rem] leading-[1.03] md:pb-6 md:pl-8 md:pt-16 md:text-[clamp(2.5rem,4.25vw,5.25rem)]">
              <span className="md:block">The same corner, </span>
              <span className="md:block">
                ninety<span className="mx-[-0.05em]">-</span>three years apart.
              </span>
            </h1>
          </HomeHero>
          <div className="tn-home-band flex flex-col gap-4 px-4 pb-8 pt-3 md:flex-row md:items-center md:justify-between md:gap-10 md:border-t md:py-0">
            <p className="max-w-[36rem] text-lg leading-snug text-muted-foreground md:text-xl">
              Old photographs of New Zealand places, each paired with a modern retake.
            </p>
            <CtaLink href="/places" className="w-full md:w-auto">
              Explore the places
            </CtaLink>
          </div>
        </section>

        <section className="space-y-12 px-4 pb-20 pt-12 md:space-y-20 md:pb-28 md:pt-24">
          <div className="grid gap-4 md:grid-cols-2 md:items-end md:gap-10">
            <h2 className="font-serif text-5xl leading-none md:text-7xl">Photographed twice.</h2>
            <p className="max-w-xl text-[17px] leading-snug">
              With the corner above, these are the {originals.length} stories so far.{" "}
              <Link href="/places" className="whitespace-nowrap underline underline-offset-2">
                All {originals.length} stories
              </Link>
            </p>
          </div>

          <figure>
            <SeamTile
              href={`/${lead.slug}`}
              name={lead.name}
              thenSrc={lead.b_imageUrl}
              nowSrc={lead.a_imageUrl}
              ratio={lead.w / lead.h}
              sizes="100vw"
              trim={1.06}
              wide
            />
            <figcaption className="mt-2">
              <Link href={`/${lead.slug}`} className={STORY_TITLE}>
                {lead.name}
              </Link>
              <dl className="mt-2 grid gap-3 md:grid-cols-2 md:gap-0">
                {leadSections.map((section) => (
                  <div key={section.year} className="max-w-md md:pr-8">
                    <dt className="font-medium tabular-nums">{section.year}</dt>
                    <dd className="mt-0.5 space-y-1 leading-snug text-muted-foreground">
                      {section.lines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </figcaption>
          </figure>

          <StoryRow stories={rest.slice(0, 2)} />
          <StoryRow stories={rest.slice(2, 4)} />
        </section>

        <section className="grid gap-10 border-t px-4 pb-20 pt-10 md:grid-cols-2 md:gap-10 md:pb-28">
          <div className="space-y-5">
            <h2 className="font-serif text-5xl leading-none md:text-7xl">Find a place</h2>
            <Form action="/places" className="relative max-w-xl">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                name="q"
                aria-label="Search places"
                placeholder="A street, a bay, a building"
                className="h-14 w-full rounded-full border border-input bg-popover pl-12 pr-5 text-lg placeholder:text-muted-foreground"
              />
            </Form>
            <div className="flex flex-wrap gap-x-6">
              <Link href="/places" className="inline-block py-2 underline underline-offset-4">
                Browse all {posts.length} places
              </Link>
              <Link href={placesHref({ view: "map" })} className="inline-block py-2 underline underline-offset-4">
                Look around the map
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
