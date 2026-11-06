import Image from "next/image"
import Link from "next/link"

import { fetchPosts } from "@/lib/api"
import { HomeHero } from "@/components/home-hero"
import { PlacesBrowser } from "@/components/places-browser"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

const HERO_SLUG = "sheep"

export default async function IndexPage() {
  const posts = await getData()
  const stories = posts.filter((post) => !post.isSample)
  const hero = posts.find((post) => post.slug === HERO_SLUG) ?? posts[0]
  const places = posts.map(
    ({ slug, name, ba_imageUrl, location, area, isSample }) => ({
      slug,
      name,
      ba_imageUrl,
      location,
      area,
      isSample,
    })
  )

  return (
    <>
      <SiteHeader />
      <main className="pt-14">
        <HomeHero post={hero} />

        <section
          aria-labelledby="stories-title"
          className="px-4 pt-10 lg:pt-14"
        >
          <h2
            id="stories-title"
            className="font-serif text-3xl tracking-tight sm:text-4xl"
          >
            Stories
          </h2>
          <ul className="mt-5 grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:mt-6 lg:grid-cols-3 lg:gap-y-10">
            {stories.map((story) => (
              <li key={story.slug}>
                <Link
                  href={`/${story.slug}`}
                  className="group block rounded-sm"
                >
                  <span className="relative block aspect-[3/2] overflow-hidden rounded-sm bg-muted">
                    <Image
                      src={story.ba_imageUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                    />
                  </span>
                  <span className="mt-2.5 block text-pretty font-serif text-xl leading-snug group-hover:underline group-hover:underline-offset-4">
                    {story.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <PlacesBrowser places={places} />
      </main>
      <SiteFooter />
    </>
  )
}

async function getData() {
  const posts = await fetchPosts()

  if (!posts) {
    throw new Error("Failed to fetch posts")
  }

  return posts
}
