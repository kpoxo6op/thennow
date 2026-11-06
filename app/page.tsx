import Form from "next/form"
import Link from "next/link"
import { ArrowRight, Search } from "lucide-react"
import type PostType from "@/interfaces/post"

import { fetchPosts } from "@/lib/api"
import { placesHref } from "@/lib/places"
import { SOURCE_LINE, toSections } from "@/components/Desc"
import { CtaLink } from "@/components/cta-link"
import { HomeHero } from "@/components/home-hero"
import { StoryTile } from "@/components/story-tile"
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

export default async function IndexPage() {
  const posts = await fetchPosts()
  const hero = posts.find((post) => post.slug === HERO_SLUG) ?? posts[0]
  const originals = posts.filter((post) => !post.sample)
  const lead = originals.find((post) => post.slug === LEAD_SLUG) ?? originals[0]
  const rest = originals.filter((post) => post !== hero && post !== lead)
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
              <Link href={`/${hero.slug}`} className="-my-1 py-1 underline underline-offset-4">
                {hero.name}
              </Link>
            }
          />
          <div className="flex flex-col gap-4 border-t px-4 pb-10 pt-4 md:min-h-[var(--hero-band-h)] md:flex-row md:items-center md:gap-12 md:py-4">
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

        <section className="px-4 pb-20 pt-10 md:pb-28 md:pt-16">
          <div className="flex flex-col gap-4 border-t pt-5 lg:flex-row lg:items-center lg:gap-8">
            <h2 className="font-serif text-4xl leading-none md:text-5xl lg:mr-auto">Photographed twice.</h2>
            <Form action="/places" className="relative lg:w-96">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                name="q"
                aria-label="Search places"
                placeholder="A street, a bay, a building"
                className="h-12 w-full rounded-full border border-input bg-popover pl-11 pr-5 placeholder:text-muted-foreground"
              />
            </Form>
            <Link href={placesHref({ view: "map" })} className="-my-1 self-start py-1 underline underline-offset-4 lg:self-auto">
              Look around the map
            </Link>
          </div>

          <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 md:mt-8 md:gap-x-6 md:gap-y-12 lg:grid-cols-6">
            {[lead, ...rest].map((story, index) => (
              <li
                key={story.slug}
                className={index === 0 ? "col-span-2 lg:col-span-3" : index === 1 ? "col-span-2 max-lg:col-span-1 lg:col-span-3" : "lg:col-span-2"}
              >
                <StoryTile story={story} sizes={index < 2 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 33vw, 50vw"} />
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
