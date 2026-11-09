import { Metadata } from "next"
import { notFound } from "next/navigation"
import type PostType from "@/interfaces/post"
import type { PendingPost as PendingPostType } from "@/interfaces/post"
import { fetchPending, fetchPosts } from "@/lib/api"
import { PLACEHOLDER, SOURCE_LINE, toSections } from "@/components/Desc"
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
      .filter((line) => !SOURCE_LINE.test(line) && line !== PLACEHOLDER)
      .join(" "),
  }
}

export async function generateStaticParams(): Promise<StaticParams> {
  const posts = [...(await fetchPosts()), ...(await fetchPending())]
  return posts.map((post) => ({
    slug: post.slug,
  }))
}

const NEARBY_KM = 25

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

  // Every other place, photographed twice or not yet, nearest first.
  const places = post.sample
    ? (await fetchPosts()).filter((other) => other.sample)
    : [...(await fetchPosts()), ...(await fetchPending())].filter((other) => !other.sample)
  const nearby = places
    .filter((other) => other.slug !== post.slug)
    .map((other) => ({ name: other.name, slug: other.slug, km: kilometres(post, other) }))
    .sort((a, b) => a.km - b.km)
    // Up to six within reach of a day out; a remote place still gets its three nearest.
    .filter((other, index) => index < 3 || (index < 6 && other.km <= NEARBY_KM))

  return post.status === "pending" ? <PendingPost post={post} nearby={nearby} /> : <Post post={post} nearby={nearby} />
}
