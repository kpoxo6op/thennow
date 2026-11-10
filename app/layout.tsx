import { Analytics } from "@vercel/analytics/react"

import "@/styles/globals.css"

import { Metadata, Viewport } from "next"

import { siteConfig } from "@/config/site"
import { fetchPosts } from "@/lib/api"
import { fontSans, fontSerif } from "@/lib/fonts"
import { linkPreview } from "@/lib/preview"
import { cn } from "@/lib/utils"
import { TailwindIndicator } from "@/components/tailwind-indicator"
import { ThemeProvider } from "@/components/theme-provider"

const HERO_SLUG = siteConfig.heroSlug

// Pages without a photograph of their own are sent with the homepage's pair.
export async function generateMetadata(): Promise<Metadata> {
  const posts = await fetchPosts()
  const hero = posts.find((post) => post.slug === HERO_SLUG) ?? posts[0]
  const preview = linkPreview({
    path: "/",
    title: siteConfig.name,
    description: siteConfig.description,
    picture: {
      src: hero.ba_imageUrl,
      w: hero.w,
      h: hero.h,
      alt: `${hero.name}, then and now`,
    },
  })

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: siteConfig.name,
      template: `%s - ${siteConfig.name}`,
    },
    description: siteConfig.description,
    icons: {
      icon: "/favicon.ico",
    },
    ...preview,
    // Only the homepage is canonically "/"; every other page names itself or nothing.
    alternates: { types: preview.alternates?.types },
    openGraph: { ...preview.openGraph, url: undefined },
  }
}

export const viewport: Viewport = {
  themeColor: "#141210",
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "flex min-h-screen flex-col bg-background font-sans antialiased",
          fontSans.variable,
          fontSerif.variable
        )}
      >
        <ThemeProvider attribute="class" forcedTheme="dark">
          {children}
          <TailwindIndicator />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
