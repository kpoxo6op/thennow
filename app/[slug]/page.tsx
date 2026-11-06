import { Metadata } from "next"
import { notFound } from "next/navigation"
import type PostType from "@/interfaces/post"
import type { PendingPost as PendingPostType } from "@/interfaces/post"
import { fetchPending, fetchPosts } from "@/lib/api"
import { SOURCE_LINE, toSections } from "@/components/Desc"
import { PendingPost } from "@/components/pending-post"
import Post, { type StoryLink } from "@/components/Post"

function isWritten(story: PostType) {
  return toSections(story.description).some((section) => section.year)
}

function toLink(story: PostType): StoryLink {
  const { name, slug, b_imageUrl, a_imageUrl, w, h, sample } = story

  return { name, slug, b_imageUrl, a_imageUrl, w, h, sample, written: isWritten(story) }
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
  const posts = [...(await fetchPosts()), ...(await fetchPending())]

  return posts.find((post) => post.slug === slug) ?? null
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
  const posts = [...(await fetchPosts()), ...(await fetchPending())]
  return posts.map((post) => ({
    slug: post.slug,
  }))
}

// Written and unwritten stories take turns, so "Next story" never strings together pages
// that say only "Coming soon...", and the loop still visits all of them.
function storyLoop(originals: PostType[]) {
  const dated = originals.filter(isWritten)
  const undated = originals.filter((story) => !dated.includes(story))
  const longest = Math.max(dated.length, undated.length)

  return Array.from({ length: longest }).flatMap((_, index) =>
    [dated[index], undated[index]].filter((story): story is PostType => Boolean(story))
  )
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

    return (
      <PendingPost
        post={post}
        stories={near(posts.filter((other) => !other.sample)).slice(0, 4)}
        pending={near(await fetchPending())}
      />
    )
  }

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
