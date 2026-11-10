import type { Metadata } from "next"

import { siteConfig } from "@/config/site"

const PREVIEW_WIDTH = 1200

type Picture = { src: string; w: number; h: number; alt: string }

// What a link to a page looks like when it is sent to someone: its photograph, its name and a
// line about it. The photograph goes through the image optimizer, so a 4000px scan arrives as
// a picture a chat app will actually show.
export function linkPreview({
  path,
  title,
  description,
  picture,
}: {
  path: string
  title: string
  description: string
  picture: Picture
}): Pick<Metadata, "alternates" | "openGraph" | "twitter"> {
  const width = Math.min(PREVIEW_WIDTH, picture.w)
  const image = {
    url: `/_next/image?url=${encodeURIComponent(picture.src)}&w=${PREVIEW_WIDTH}&q=75`,
    width,
    height: Math.round((width * picture.h) / picture.w),
    alt: picture.alt,
  }

  return {
    alternates: {
      canonical: path,
      // Feed readers find the feed here; the page needs no link to it.
      types: { "application/rss+xml": "/feed.xml" },
    },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      locale: "en_NZ",
      url: path,
      title,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  }
}
