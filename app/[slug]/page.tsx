import { Metadata } from "next"
import { notFound } from "next/navigation"
import type PostType from "@/interfaces/post"
import { fetchPosts } from "@/lib/api"
import Post, { type StoryLink } from "@/components/Post"

function toLink({ name, slug, b_imageUrl, a_imageUrl, w, h, sample }: PostType): StoryLink {
  return { name, slug, b_imageUrl, a_imageUrl, w, h, sample }
}

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
  const posts = await fetchPosts()
  const post = posts.find((post) => post.slug === slug)

  if (!post) {
    return null
  }

  return post
}

export async function generateMetadata({ params }: PostProps): Promise<Metadata> {
  const post = await getPostFromParams(params)

  if (!post) {
    return {}
  }

  return {
    title: post.name,
    description: post.description,
  }
}

export async function generateStaticParams(): Promise<StaticParams> {
  const posts = await fetchPosts()
  return posts.map((post) => ({
    slug: post.slug,
  }))
}

function kilometres(a: PostType, b: PostType) {
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
  const originals = posts.filter((other) => !other.sample)
  const byDistance = (candidates: PostType[]) =>
    candidates
      .filter((other) => other.slug !== post.slug)
      .map((other) => ({ story: other, km: kilometres(post, other) }))
      .sort((a, b) => a.km - b.km)

  // A sample leads to the real story behind its photographs; a story to the next one.
  const source = post.sample ? originals.find((other) => other.slug === post.imageSourceSlug) : undefined
  const next = post.sample
    ? source
    : originals[(originals.findIndex((other) => other.slug === post.slug) + 1) % originals.length]
  const nearby = post.sample
    ? byDistance(posts.filter((other) => other.sample)).slice(0, 4)
    : byDistance(originals).filter(({ story }) => story.slug !== next?.slug)

  return (
    <Post
      post={post}
      next={next ? toLink(next) : undefined}
      nearby={nearby.map(({ story, km }) => ({ ...toLink(story), km }))}
    />
  )
}
