import { Suspense } from "react"
import { Metadata } from "next"

import {
  fetchPending,
  fetchPosts,
  toPendingSummary,
  toSummary,
} from "@/lib/api"
import { PlacesExplorer, PlacesFallback } from "@/components/places-explorer"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
  title: "Places",
}

export default async function PlacesPage() {
  const posts = await fetchPosts()
  const pending = await fetchPending()
  const stories = [...posts.map(toSummary), ...pending.map(toPendingSummary)]

  return (
    <>
      <SiteHeader />
      <Suspense fallback={<PlacesFallback stories={stories} />}>
        <PlacesExplorer stories={stories} />
      </Suspense>
      <SiteFooter />
    </>
  )
}
