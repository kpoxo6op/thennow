import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { fetchPending, fetchPosts } from "@/lib/api"
import { referenceLines } from "@/lib/rephoto/reference-lines"
import { DecisionExperiment } from "@/components/rephoto/decision-experiment"

export const metadata: Metadata = {
  title: "Animated camera guide experiment",
  robots: { index: false },
}
export const dynamic = "force-dynamic"

export default async function ExperimentPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const place = [...(await fetchPosts()), ...(await fetchPending())].find(
    (p) => p.slug === slug && !p.sample
  )
  if (!place || !referenceLines(slug, place.b_imageUrl)) notFound()
  return (
    <DecisionExperiment
      name={place.name}
      slug={slug}
      thenSrc={place.b_imageUrl}
      aspect={place.h / place.w}
      available={
        process.env.TN_DECISIONS_EXPERIMENT === "1" &&
        !!process.env.OPENAI_API_KEY
      }
    />
  )
}
