"use client"

import { useCallback, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type PostType from "@/interfaces/post"

import { HomeMap, type MapViewport } from "@/components/home-map"

type Props = {
  posts: PostType[]
}

const VIEWPORT_LIMITS = {
  minLat: -37.2,
  maxLat: -36.55,
  minLng: 174.25,
  maxLng: 175.05,
  minZoom: 9,
  maxZoom: 16,
}

function clampViewport(viewport: MapViewport): MapViewport {
  return {
    lat: Math.min(
      VIEWPORT_LIMITS.maxLat,
      Math.max(VIEWPORT_LIMITS.minLat, viewport.lat)
    ),
    lng: Math.min(
      VIEWPORT_LIMITS.maxLng,
      Math.max(VIEWPORT_LIMITS.minLng, viewport.lng)
    ),
    z: Math.min(
      VIEWPORT_LIMITS.maxZoom,
      Math.max(VIEWPORT_LIMITS.minZoom, viewport.z)
    ),
  }
}

function getSnippet(description: string) {
  return description.split("\n").filter(Boolean).slice(0, 3).join(" ")
}

export function HomeExplorer({ posts }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [visibleSlugs, setVisibleSlugs] = useState<string[]>(
    posts.map((post) => post.slug)
  )

  const viewport = useMemo(() => {
    const lat = Number(searchParams.get("lat"))
    const lng = Number(searchParams.get("lng"))
    const z = Number(searchParams.get("z"))

    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Number.isFinite(z) &&
      lat >= VIEWPORT_LIMITS.minLat &&
      lat <= VIEWPORT_LIMITS.maxLat &&
      lng >= VIEWPORT_LIMITS.minLng &&
      lng <= VIEWPORT_LIMITS.maxLng &&
      z >= VIEWPORT_LIMITS.minZoom &&
      z <= VIEWPORT_LIMITS.maxZoom
    ) {
      return { lat, lng, z }
    }

    return null
  }, [searchParams])

  const handleVisibleSlugsChange = useCallback((slugs: string[]) => {
    setVisibleSlugs(slugs)
  }, [])

  const handleViewportChange = useCallback(
    (nextViewport: MapViewport) => {
      const safeViewport = clampViewport(nextViewport)
      const params = new URLSearchParams(searchParams.toString())
      const nextLat = String(safeViewport.lat)
      const nextLng = String(safeViewport.lng)
      const nextZoom = String(safeViewport.z)

      if (
        params.get("lat") === nextLat &&
        params.get("lng") === nextLng &&
        params.get("z") === nextZoom
      ) {
        return
      }

      params.set("lat", nextLat)
      params.set("lng", nextLng)
      params.set("z", nextZoom)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const visiblePosts = useMemo(() => {
    const slugSet = new Set(visibleSlugs)
    const inView = posts.filter((post) => slugSet.has(post.slug))

    return inView.length > 0 ? inView : posts
  }, [posts, visibleSlugs])

  return (
    <>
      <section className="container mt-10 px-4 sm:px-6">
        <HomeMap
          posts={posts}
          onVisibleSlugsChange={handleVisibleSlugsChange}
          onViewportChange={handleViewportChange}
          viewport={viewport}
        />
      </section>

      <section className="container mt-10 px-4 sm:px-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            Stories in view
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {visiblePosts.map((post) => (
            <Link
              key={post.slug}
              href={`/${post.slug}`}
              className="overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm transition-transform hover:-translate-y-1"
            >
              <Image
                src={post.ba_imageUrl}
                alt={post.name}
                width={post.w}
                height={post.h}
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="space-y-2 p-5">
                <h2 className="text-xl font-semibold tracking-tight">
                  {post.name}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {getSnippet(post.description)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
