import { Metadata } from "next"
import { fetchPosts } from "@/lib/api"
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

export default async function PostPage({ params }: PostProps) {
  const post = await getPostFromParams(params)

  if (!post) {
    throw new Error("Failed to fetch posts")
  }

  return <Post post={post} />
}
