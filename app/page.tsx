import type { Viewport } from "next"
import Form from "next/form"
import Link from "next/link"
import { ArrowRight, Search } from "lucide-react"
import type PostType from "@/interfaces/post"

import { fetchPosts } from "@/lib/api"
import { fontHomeSans, fontHomeSerif } from "@/lib/fonts"
import { placesHref, STORIES_AREA } from "@/lib/places"
import { cn } from "@/lib/utils"
import { SOURCE_LINE, toSections } from "@/components/Desc"
import { HomeHero } from "@/components/home-hero"
import { SeamTile } from "@/components/seam-tile"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

const HERO_SLUG = "sheep"
const LEAD_SLUG = "historic-post-office"

export const viewport: Viewport = {
  themeColor: "#13120f",
}

// Dated, written sections only: several stories are still "Coming soon...".
function datedSections(story: PostType) {
  return toSections(story.description)
    .filter((section) => section.year)
    .map((section) => ({
      year: section.year as string,
      lines: section.lines.filter((line) => !SOURCE_LINE.test(line)),
    }))
}

function StoryCaption({ story }: { story: PostType }) {
  const sections = datedSections(story)

  return (
    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <Link
        href={`/${story.slug}`}
        className="-my-1 py-1 font-serif text-2xl leading-tight underline-offset-4 hover:underline"
      >
        {story.name}
      </Link>
      {sections.length > 1 ? (
        <span className="text-sm tabular-nums text-muted-foreground">
          {sections[0].year} and {sections[sections.length - 1].year}
        </span>
      ) : null}
    </div>
  )
}

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
            sizes="(min-width: 768px) 50vw, 100vw"
          />
          <figcaption>
            <StoryCaption story={story} />
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
  const areas = new Map<string, number>()

  posts.forEach((post) => {
    if (post.area) {
      areas.set(post.area, (areas.get(post.area) ?? 0) + 1)
    }
  })

  const sampleCount = posts.length - originals.length

  return (
    <div className={cn("tn-home flex flex-1 flex-col font-sans", fontHomeSans.variable, fontHomeSerif.variable)}>
      <SiteHeader className="bg-background md:absolute md:bg-transparent md:[&_a]:text-white" />
      <main className="tn-enter flex-1">
        <section className="relative">
          <HomeHero
            name={hero.name}
            thenSrc={hero.b_imageUrl}
            nowSrc={hero.a_imageUrl}
            ratio={hero.w / hero.h}
            thenYear={thenYear}
            nowYear={nowYear}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 hidden h-28 bg-gradient-to-b from-black/60 to-transparent md:block"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[44%] bg-gradient-to-t from-black/85 via-black/45 to-transparent md:block"
          />
          <div className="pointer-events-none relative grid gap-5 px-4 pb-8 pt-4 md:absolute md:inset-x-0 md:bottom-0 md:grid-cols-[3fr_2fr] md:items-end md:gap-10 md:pb-10 md:text-white">
            <h1 className="font-serif text-[2.75rem] leading-[1.02] md:text-5xl lg:text-6xl xl:text-[5rem]">
              <span className="md:block">The same corner, </span>
              <span className="md:block">ninety-three years apart.</span>
            </h1>
            <div className="space-y-4">
              <p className="max-w-md text-[17px] leading-snug">
                then|now pairs old photographs of New Zealand places with a modern
                retake. Drag the line to see what stayed and what disappeared.
              </p>
              <div className="pointer-events-auto flex flex-wrap items-center gap-x-6 gap-y-2">
                <Link
                  href="/places"
                  className="inline-flex h-12 items-center gap-2 bg-foreground px-5 font-medium text-background transition-opacity hover:opacity-85"
                >
                  Explore the places
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
                <Link href={placesHref({ view: "map" })} className="py-3 underline underline-offset-4">
                  Open the map
                </Link>
              </div>
              <Link
                href={`/${hero.slug}`}
                className="pointer-events-auto block text-sm underline-offset-4 opacity-80 hover:underline"
              >
                {hero.name}
              </Link>
            </div>
          </div>
        </section>

        <section className="space-y-14 px-4 pb-20 pt-16 md:space-y-20 md:pb-28 md:pt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="font-serif text-5xl leading-none md:text-7xl">Photographed twice.</h2>
            <Link
              href={placesHref({ area: STORIES_AREA })}
              className="-my-2 py-2 underline underline-offset-4"
            >
              All {originals.length} stories
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-[3fr_1fr] md:gap-8">
            <figure className="min-w-0">
              <SeamTile
                href={`/${lead.slug}`}
                name={lead.name}
                thenSrc={lead.b_imageUrl}
                nowSrc={lead.a_imageUrl}
                ratio={lead.w / lead.h}
                sizes="(min-width: 768px) 75vw, 100vw"
              />
              <figcaption>
                <StoryCaption story={lead} />
              </figcaption>
            </figure>
            <dl className="space-y-6 md:self-end md:pb-12">
              {leadSections.map((section) => (
                <div key={section.year} className="border-t pt-2">
                  <dt className="font-serif text-4xl">{section.year}</dt>
                  <dd className="mt-2 space-y-1 text-[15px] leading-snug text-muted-foreground">
                    {section.lines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <StoryRow stories={rest.slice(0, 2)} />
          <StoryRow stories={rest.slice(2, 4)} />
        </section>

        <section className="grid gap-12 border-t px-4 pb-20 pt-10 md:grid-cols-2 md:gap-10 md:pb-28">
          <div className="space-y-6">
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
                className="h-14 w-full border border-input bg-popover pl-12 pr-5 text-lg placeholder:text-muted-foreground"
              />
            </Form>
            <Link href="/places" className="inline-block py-2 underline underline-offset-4">
              Browse all {posts.length} places
            </Link>
          </div>
          <div>
            <p className="mb-5 max-w-lg text-[15px] leading-snug text-muted-foreground">
              Beyond the {originals.length} original stories, this preview holds {sampleCount} sample
              places: fictional Auckland-area locations that repeat these photographs as placeholders.{" "}
              <Link href="/about" className="underline underline-offset-2 hover:text-foreground">
                More about the project
              </Link>
            </p>
            <ul>
              {Array.from(areas).map(([area, count]) => (
                <li key={area} className="border-b first:border-t">
                  <Link
                    href={placesHref({ area })}
                    className="flex items-baseline justify-between gap-4 py-2.5 font-serif text-2xl underline-offset-4 hover:underline"
                  >
                    {area}
                    <span className="font-sans text-sm tabular-nums text-muted-foreground">
                      {count} samples
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
