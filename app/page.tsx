import { Suspense } from "react"

import { fetchPosts } from "@/lib/api"
import { HomeExplorer } from "@/components/home-explorer"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default async function IndexPage() {
  const posts = await getData()

  return (
    <>
      <SiteHeader />
      <main className="pb-16 pt-24 sm:pt-28">
        <section className="container space-y-8 px-4 sm:px-6">
          <div className="space-y-5 pt-2">
            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              <span className="block sm:inline">New Zealand</span>{" "}
              <span className="block sm:inline">Then and Now</span>
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              then|now is a visual archive of places photographed across time.
              Each story pairs an older image with a modern retake so visitors
              can see what stayed, what disappeared, and what the street looks
              like now.
            </p>
          </div>
        </section>
        <Suspense fallback={null}>
          <HomeExplorer posts={posts} />
        </Suspense>
      </main>
      <SiteFooter className="pb-8" />
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
