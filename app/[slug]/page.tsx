// single post page
import { Metadata } from 'next'
import { fetchPosts } from "@/lib/api"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import Image from "next/image"
import Link from "next/link"

interface PostProps {
  params: {
    slug: string
  }
}

async function getPostFromParams(params: PostProps["params"]) {
  const slug = params.slug
  const posts = await fetchPosts();
  const post = posts.find((post) => post.slug === slug)

  if (!post) {
    null
  }

  return post
}


export async function generateMetadata({ params, }: PostProps): Promise<Metadata> {
  const post = await getPostFromParams(params)

  if (!post) {
    return {}
  }

  return {
    title: post.name,
    description: post.description,
  }
}

export async function generateStaticParams(): Promise<PostProps["params"][]> {
  const posts = await fetchPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}


export default async function PostPage({ params }: PostProps) {
  const post = await getPostFromParams(params)

  if (!post) {
    throw new Error('Failed to fetch posts');
  }

  return (
    <Card key={post.name}>
      <CardContent>
        <Link href={`${post.slug}/slider`}>
          <Image
            src={post.ba_imageUrl}
            alt={post.name}
            width={post.w}
            height={post.h}
          >
          </Image>
        </Link>
      </CardContent>
      <CardHeader>
        <CardTitle>{post.name}</CardTitle>
        <CardDescription className="whitespace-pre-line">
          {post.description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
