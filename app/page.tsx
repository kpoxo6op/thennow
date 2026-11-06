import { Suspense } from "react"

import { fetchPosts } from "@/lib/api"
import { HomeExplorer, HomeExplorerFallback } from "@/components/home-explorer"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default async function IndexPage() {
  const posts = await getData()
  const stories = posts.map(({ name, ba_imageUrl, w, h, slug, location }) => ({
    name,
    ba_imageUrl,
    w,
    h,
    slug,
    location,
  }))

  return (
    <>
      <SiteHeader />
      <Suspense fallback={<HomeExplorerFallback posts={stories} />}>
        <HomeExplorer posts={stories} />
      </Suspense>
      <SiteFooter
        note={
          posts.some((post) => post.sample)
            ? "This preview includes sample locations."
            : undefined
        }
      />
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
