import { Metadata } from "next"
import { notFound } from "next/navigation"
import type PostType from "@/interfaces/post"
import { fetchPosts } from "@/lib/api"
import { SOURCE_LINE, toSections } from "@/components/Desc"
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
    description: toSections(post.description)
      .flatMap((section) => section.lines)
      .filter((line) => !SOURCE_LINE.test(line))
      .join(" "),
  }
}

export async function generateStaticParams(): Promise<StaticParams> {
  const posts = await fetchPosts()
  return posts.map((post) => ({
    slug: post.slug,
  }))
}

// Written and unwritten stories take turns, so "Next story" never strings together pages
// that say only "Coming soon...", and the loop still visits all of them.
function storyLoop(originals: PostType[]) {
  const dated = originals.filter((story) => toSections(story.description).some((section) => section.year))
  const undated = originals.filter((story) => !dated.includes(story))
  const longest = Math.max(dated.length, undated.length)

  return Array.from({ length: longest }).flatMap((_, index) =>
    [dated[index], undated[index]].filter((story): story is PostType => Boolean(story))
  )
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
  const loop = storyLoop(originals)
  const next = post.sample ? source : loop[(loop.findIndex((other) => other.slug === post.slug) + 1) % loop.length]
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
