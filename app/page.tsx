import Form from "next/form"
import Image from "next/image"
import Link from "next/link"
import { Search } from "lucide-react"
import type PostType from "@/interfaces/post"

import { fetchPosts } from "@/lib/api"
import { placesHref, STORIES_AREA } from "@/lib/places"
import { toSections } from "@/components/Desc"
import { HomeHero } from "@/components/home-hero"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

const HERO_SLUG = "sheep"

function StoryRow({ stories }: { stories: PostType[] }) {
  return (
    <div className="flex flex-col gap-8 md:flex-row md:gap-4">
      {stories.map((story) => (
        <Link
          key={story.slug}
          href={`/${story.slug}`}
          className="group block min-w-0"
          style={{ flex: `${story.w / story.h} 1 0%` }}
        >
          <Image
            src={story.ba_imageUrl}
            alt=""
            width={story.w}
            height={story.h}
            sizes="(min-width: 768px) 50vw, 100vw"
            className="w-full bg-muted transition-opacity duration-200 group-hover:opacity-85"
          />
          <span className="mt-2 block font-serif text-xl leading-snug underline-offset-4 group-hover:underline sm:text-2xl">
            {story.name}
          </span>
        </Link>
      ))}
    </div>
  )
}

export default async function IndexPage() {
  const posts = await fetchPosts()
  const hero = posts.find((post) => post.slug === HERO_SLUG) ?? posts[0]
  const heroSections = toSections(hero.description)
  const originals = posts.filter((post) => !post.sample)
  const rows = [originals.slice(0, 2), originals.slice(2, 4), originals.slice(4, 6)]
  const areas = new Map<string, number>()

  posts.forEach((post) => {
    if (post.area) {
      areas.set(post.area, (areas.get(post.area) ?? 0) + 1)
    }
  })

  return (
    <>
      <SiteHeader />
      <main className="tn-enter flex-1">
        <HomeHero
          name={hero.name}
          thenSrc={hero.b_imageUrl}
          nowSrc={hero.a_imageUrl}
          ratio={hero.w / hero.h}
        />

        <div className="flex h-10 items-center justify-between gap-4 px-4 font-serif text-sm italic text-muted-foreground">
          <span className="shrink-0">then {heroSections[0]?.year}</span>
          <Link
            href={`/${hero.slug}`}
            className="-my-2 truncate py-2 not-italic text-foreground underline underline-offset-4"
          >
            {hero.name}
          </Link>
          <span className="shrink-0">now {heroSections[heroSections.length - 1]?.year}</span>
        </div>

        <section className="grid gap-5 px-4 pb-14 pt-4 md:grid-cols-[3fr_2fr] md:items-end md:gap-10 md:pb-20">
          <h1 className="font-serif text-[2.75rem] leading-[1.02] tracking-tight sm:text-6xl xl:text-7xl">
              <span className="block">New Zealand,</span>
            <span className="block">then and now.</span>
          </h1>
          <div className="space-y-4">
            <p className="max-w-md font-serif text-xl leading-snug">
              One place, two moments. Drag the line across any photograph to see
              what stayed and what disappeared.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link
                href="/places"
                className="inline-flex h-12 items-center rounded-full bg-foreground px-6 text-background transition-opacity hover:opacity-85"
              >
                Explore the places
              </Link>
              <Link
                href={placesHref({ view: "map" })}
                className="py-3 underline underline-offset-4"
              >
                Open the map
              </Link>
            </div>
          </div>
        </section>

        <section className="space-y-8 px-4 pb-16 md:space-y-10 md:pb-24">
          <h2 className="border-t pt-4 font-serif text-3xl tracking-tight">
            <Link
              href={placesHref({ area: STORIES_AREA })}
              className="underline-offset-4 hover:underline"
            >
              Stories
            </Link>
          </h2>
          {rows.map((row) => (
            <StoryRow key={row[0]?.slug} stories={row} />
          ))}
        </section>

        <section className="grid gap-8 border-t px-4 pb-16 pt-4 md:grid-cols-[3fr_2fr] md:gap-10 md:pb-24">
          <div className="space-y-6">
            <h2 className="font-serif text-3xl tracking-tight">Find a place</h2>
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
            <Link
              href={placesHref({ view: "map" })}
              className="inline-block py-2 font-serif text-xl underline underline-offset-4"
            >
              Or look around the map
            </Link>
          </div>
          <ul className="md:pt-12">
            {Array.from(areas).map(([area, count]) => (
              <li key={area} className="border-b first:border-t">
                <Link
                  href={placesHref({ area })}
                  className="flex items-baseline justify-between gap-4 py-3 font-serif text-xl underline-offset-4 hover:underline"
                >
                  {area}
                  <span className="font-sans text-sm text-muted-foreground">
                    {count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
