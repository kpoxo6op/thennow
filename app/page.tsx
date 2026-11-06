import { fetchPosts } from "@/lib/api"
import { HomeExplorer } from "@/components/home-explorer"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default async function IndexPage() {
  const posts = await getData()
  const spots = posts.map(({ slug, name, ba_imageUrl, location }) => ({
    slug,
    name,
    ba_imageUrl,
    location,
  }))

  return (
    <>
      <SiteHeader />
      <main className="pt-14">
        <HomeExplorer
          spots={spots}
          hasSampleContent={posts.some((post) => post.isSample)}
        />
      </main>
      <SiteFooter className="mt-auto" />
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
