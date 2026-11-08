import { Metadata, Viewport } from "next"
import { notFound } from "next/navigation"

import { fetchPending, fetchPosts } from "@/lib/api"
import { RephotoCamera } from "@/components/rephoto/rephoto-camera"

interface Props {
  params: Promise<{ slug: string }>
}

// Edge to edge, around the notch.
export const viewport: Viewport = {
  themeColor: "#000000",
  viewportFit: "cover",
}

async function findPlace(params: Props["params"]) {
  const { slug } = await params
  const places = [...(await fetchPosts()), ...(await fetchPending())]

  return places.find((place) => place.slug === slug && !place.sample) ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const place = await findPlace(params)

  return place
    ? { title: `Photograph ${place.name} now`, robots: { index: false } }
    : {}
}

export async function generateStaticParams() {
  const places = [...(await fetchPosts()), ...(await fetchPending())]

  return places
    .filter((place) => !place.sample)
    .map((place) => ({ slug: place.slug }))
}

export default async function CameraPage({ params }: Props) {
  const place = await findPlace(params)

  if (!place) {
    notFound()
  }

  return (
    <RephotoCamera
      name={place.name}
      slug={place.slug}
      thenSrc={place.b_imageUrl}
      aspect={place.h / place.w}
    />
  )
}
