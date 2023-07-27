import { siteConfig } from "@/config/site"
import { fetchPosts } from "@/lib/api"
import AllPosts from "@/components/all-posts"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export default async function IndexPage() {
  const posts = await getData();
  return (
    <>
      <SiteHeader />
      <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
        <div className="container flex flex-col items-center gap-4 text-center">
          <h1 className="text-6xl font-extrabold leading-tight tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl">
            New Zealand <br className="hidden sm:inline" />then & now
          </h1>
        </div>
      </section>
      {posts.length > 0 && <AllPosts posts={posts} />}
      <SiteFooter />
    </>
  )
}

async function getData() {
  const posts = await fetchPosts();


  if (!posts) {
    throw new Error('Failed to fetch posts');
  }

  return posts;
}

