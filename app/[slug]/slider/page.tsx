//  check where metadata is inserted
import { Metadata } from 'next'
import { fetchPosts } from "@/lib/api"
import ImageComparisonSlider from '@/components/ImageComparisonSlider'

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

export default async function SliderPage({ params }: PostProps) {

  const post = await getPostFromParams(params)

  if (!post) {
    throw new Error('Failed to fetch posts');
  }


  return (
    <ImageComparisonSlider post={post} />
  );
}
