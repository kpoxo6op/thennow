import { Metadata, Viewport } from "next"
import { notFound } from "next/navigation"

import { fetchPending, fetchPosts } from "@/lib/api"
import { RephotoCamera } from "@/components/rephoto/rephoto-camera"

interface Props {
  params: Promise<{ slug: string }>
}

// The camera fills the screen edge to edge, around the notch, and a pinch belongs to the
// photograph rather than the page.
export const viewport: Viewport = {
  themeColor: "#000000",
  viewportFit: "cover",
  maximumScale: 1,
  userScalable: false,
}

async function findPlace(params: Props["params"]) {
  const { slug } = await params
  const places = [...(await fetchPosts()), ...(await fetchPending())]

  return places.find((place) => place.slug === slug && !place.sample) ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const place = await findPlace(params)

  return place ? { title: `Photograph ${place.name} now`, robots: { index: false } } : {}
}

export async function generateStaticParams() {
  const places = [...(await fetchPosts()), ...(await fetchPending())]

  return places.filter((place) => !place.sample).map((place) => ({ slug: place.slug }))
}

// A camera that lines a new photograph up with the archive one, for the person standing there.
export default async function CameraPage({ params }: Props) {
  const place = await findPlace(params)

  if (!place) {
    notFound()
  }

  return (
    <RephotoCamera name={place.name} slug={place.slug} thenSrc={place.b_imageUrl} aspect={place.h / place.w} />
  )
}
