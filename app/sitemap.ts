import type { MetadataRoute } from "next"

import { siteConfig } from "@/config/site"
import { fetchPending, fetchPosts } from "@/lib/api"

// Every page worth finding: the three public pages and each real place.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const places = [...(await fetchPosts()), ...(await fetchPending())].filter((place) => !place.sample)

  return ["", "/places", "/about", ...places.map((place) => `/${place.slug}`)].map((path) => ({
    url: `${siteConfig.url}${path}`,
  }))
}
