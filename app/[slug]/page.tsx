import { Metadata } from "next"
import { notFound } from "next/navigation"
import type PostType from "@/interfaces/post"
import type { PendingPost as PendingPostType } from "@/interfaces/post"
import { fetchPending, fetchPosts } from "@/lib/api"
import { SOURCE_LINE, toSections } from "@/components/Desc"
import { PendingPost } from "@/components/pending-post"
import Post from "@/components/Post"

interface PostProps {
  params: Promise<{
    slug: string
  }>
}

type StaticParams = Array<{
  slug: string
}>

async function getPostFromParams(params: PostProps["params"]) {
  const { slug } = await params
  const posts = [...(await fetchPosts()), ...(await fetchPending())]

  return posts.find((post) => post.slug === slug) ?? null
}

export async function generateMetadata({ params }: PostProps): Promise<Metadata> {
  const post = await getPostFromParams(params)

  if (!post) {
    return {}
  }

  if (post.status === "pending") {
    return { title: post.name, description: post.description }
  }

  return {
    title: post.name,
    description: toSections(post.description)
      .flatMap((section) => section.lines)
      .filter((line) => !SOURCE_LINE.test(line) && line !== "Coming soon...")
      .join(" "),
  }
}

export async function generateStaticParams(): Promise<StaticParams> {
  const posts = [...(await fetchPosts()), ...(await fetchPending())]
  return posts.map((post) => ({
    slug: post.slug,
  }))
}

function kilometres(a: PostType | PendingPostType, b: PostType | PendingPostType) {
  const radians = Math.PI / 180
  const midLat = ((a.location.lat + b.location.lat) / 2) * radians
  const x = (b.location.lng - a.location.lng) * radians * Math.cos(midLat)
  const y = (b.location.lat - a.location.lat) * radians

  return Math.hypot(x, y) * 6371
}

export default async function PostPage({ params }: PostProps) {
  const post = await getPostFromParams(params)

  if (!post) {
    notFound()
  }

  const posts = await fetchPosts()

  if (post.status === "pending") {
    const near = <T extends PostType | PendingPostType>(list: T[]) =>
      list
        .filter((other) => other.slug !== post.slug)
        .map(({ name, slug, ...place }) => ({ name, slug, km: kilometres(post, { name, slug, ...place } as T) }))
        .sort((a, b) => a.km - b.km)

    // Every other place, finished or not, nearest first.
    return (
      <PendingPost
        post={post}
        nearby={[...near(posts.filter((other) => !other.sample)), ...near(await fetchPending())]
          .sort((a, b) => a.km - b.km)
          .slice(0, 6)}
      />
    )
  }

  const originals = posts.filter((other) => !other.sample)
  const nearby = (post.sample ? posts.filter((other) => other.sample) : originals)
    .filter((other) => other.slug !== post.slug)
    .map(({ name, slug, ...place }) => ({ name, slug, km: kilometres(post, { name, slug, ...place } as PostType) }))
    .sort((a, b) => a.km - b.km)

  return <Post post={post} nearby={nearby} />
}
