import { Metadata } from "next"
import { notFound } from "next/navigation"
import { fetchPosts } from "@/lib/api"
import type PostType from "@/interfaces/post"
import Post from "@/components/Post"

const NEARBY_COUNT = 3

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

function distanceBetween(a: PostType["location"], b: PostType["location"]) {
  const latScale = Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot(a.lat - b.lat, (a.lng - b.lng) * latScale)
}

function toSummary({ slug, name, ba_imageUrl, location }: PostType) {
  return { slug, name, ba_imageUrl, location }
}

export default async function PostPage({ params }: PostProps) {
  const { slug } = await params
  const posts = await fetchPosts()
  const index = posts.findIndex((candidate) => candidate.slug === slug)

  if (index < 0) {
    notFound()
  }

  const post = posts[index]
  const previous = posts[(index - 1 + posts.length) % posts.length]
  const next = posts[(index + 1) % posts.length]
  const nearby = posts
    .filter((candidate) => ![slug, previous.slug, next.slug].includes(candidate.slug))
    .sort(
      (a, b) =>
        distanceBetween(post.location, a.location) -
        distanceBetween(post.location, b.location)
    )
    .slice(0, NEARBY_COUNT)
    .map(toSummary)
  const source = post.imageSourceSlug
    ? posts.find((candidate) => candidate.slug === post.imageSourceSlug)
    : undefined

  return (
    <Post
      post={post}
      previous={toSummary(previous)}
      next={toSummary(next)}
      nearby={nearby}
      imageSource={source ? toSummary(source) : undefined}
    />
  )
}
