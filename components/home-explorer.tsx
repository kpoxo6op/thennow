"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { StorySummary } from "@/interfaces/post"

import {
  HomeMap,
  type MapHighlight,
  type MapViewport,
} from "@/components/home-map"

type Props = {
  posts: StorySummary[]
}

const VIEWPORT_LIMITS = {
  minLat: -37.2,
  maxLat: -36.55,
  minLng: 174.25,
  maxLng: 175.05,
  minZoom: 8,
  maxZoom: 16,
}

// Kept across visits so returning from a story restores the same list before
// the map has loaded, which is what lets the browser restore the scroll offset.
let lastView: { search: string; slugs: string[] } | null = null

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

type GridProps = {
  posts: StorySummary[]
  onHighlight?: (slug: string | null) => void
  onPrefetch?: (slug: string) => void
}

const StoryGrid = memo(function StoryGrid({
  posts,
  onHighlight,
  onPrefetch,
}: GridProps) {
  return (
    <ul
      data-testid="story-list"
      className="grid grid-cols-2 gap-x-2 gap-y-6 @lg:grid-cols-3 @lg:gap-x-3 @lg:gap-y-8 @5xl:grid-cols-4"
    >
      {posts.map((post, index) => (
        <li key={post.slug}>
          <Link
            href={`/${post.slug}`}
            prefetch={false}
            data-testid="story-card"
            className="group block"
            onPointerEnter={(event) => {
              onPrefetch?.(post.slug)
              if (event.pointerType === "mouse") {
                onHighlight?.(post.slug)
              }
            }}
            onPointerLeave={() => onHighlight?.(null)}
            onFocus={() => onHighlight?.(post.slug)}
            onBlur={() => onHighlight?.(null)}
          >
            <Image
              src={post.ba_imageUrl}
              alt=""
              width={post.w}
              height={post.h}
              priority={index < 4}
              sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
              className="aspect-[3/2] w-full bg-muted object-cover transition-[filter] duration-200 group-hover:brightness-110"
            />
            <h2 className="mt-2 line-clamp-2 font-serif text-[15px] leading-snug text-foreground/85 transition-colors group-hover:text-foreground sm:text-base">
              {post.name}
            </h2>
          </Link>
        </li>
      ))}
    </ul>
  )
})

const LIST_CLASS = "@container min-w-0 px-3 pb-10 pt-5 sm:px-4 sm:pt-2"
const TITLE_CLASS = "mb-5 font-serif text-2xl tracking-tight sm:mb-6 sm:text-3xl"
const TITLE = "New Zealand Then and Now"

// The server's first paint: the whole collection, before the map's URL state is known.
export function HomeExplorerFallback({ posts }: Props) {
  return (
    <main className="tn-home tn-enter">
      <section className="tn-home-map bg-muted" />
      <section className={LIST_CLASS}>
        <h1 className={TITLE_CLASS}>{TITLE}</h1>
        <StoryGrid posts={posts} />
      </section>
    </main>
  )
}

export function HomeExplorer({ posts }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const mapSectionRef = useRef<HTMLElement | null>(null)
  const listRef = useRef<HTMLElement | null>(null)
  const highlightRef = useRef<MapHighlight | null>(null)
  const mapHasReported = useRef(false)
  const [visibleSlugs, setVisibleSlugs] = useState<string[]>(() =>
    lastView?.search === search
      ? lastView.slugs
      : posts.map((post) => post.slug)
  )

  const viewport = useMemo(() => {
    const params = new URLSearchParams(search)
    const lat = Number(params.get("lat"))
    const lng = Number(params.get("lng"))
    const z = Number(params.get("z"))

    if (
      params.has("lat") &&
      params.has("lng") &&
      params.has("z") &&
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
  }, [search])

  const handleVisibleSlugsChange = useCallback((slugs: string[]) => {
    const isFirstReport = !mapHasReported.current
    mapHasReported.current = true

    setVisibleSlugs((current) => {
      if (
        current.length === slugs.length &&
        current.every((slug, index) => slug === slugs[index])
      ) {
        return current
      }

      // The list just changed under the reader: show them its start.
      const list = listRef.current
      if (list && !isFirstReport) {
        const mapBox = mapSectionRef.current?.getBoundingClientRect()
        const mapIsAbove = mapBox ? mapBox.width >= list.getBoundingClientRect().width : false
        const stickyBottom = mapIsAbove && mapBox ? mapBox.bottom : 56
        const listTop = list.getBoundingClientRect().top

        if (listTop < stickyBottom) {
          window.scrollBy(0, listTop - stickyBottom)
        }
      }

      return slugs
    })
  }, [])

  const handleViewportChange = useCallback(
    (nextViewport: MapViewport) => {
      // A map settling after navigation must not rewrite the story's URL.
      if (window.location.pathname !== pathname) {
        return
      }

      const safeViewport = clampViewport(nextViewport)
      const params = new URLSearchParams(window.location.search)
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
      // Shallow: the page is static, so moving the map must not refetch it.
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`)
    },
    [pathname]
  )

  const handleOpenStory = useCallback(
    (slug: string) => {
      router.push(`/${slug}`)
    },
    [router]
  )

  const handleHighlight = useCallback((slug: string | null) => {
    highlightRef.current?.(slug)
  }, [])

  const handlePrefetch = useCallback(
    (slug: string) => {
      router.prefetch(`/${slug}`)
    },
    [router]
  )

  useEffect(() => {
    lastView = { search, slugs: visibleSlugs }
  }, [search, visibleSlugs])

  const visiblePosts = useMemo(() => {
    const slugSet = new Set(visibleSlugs)
    const inView = posts.filter((post) => slugSet.has(post.slug))

    return inView.length > 0 ? inView : posts
  }, [posts, visibleSlugs])

  return (
    <main className="tn-home">
      <section
        ref={mapSectionRef}
        className="tn-home-map"
      >
        <HomeMap
          posts={posts}
          onVisibleSlugsChange={handleVisibleSlugsChange}
          onViewportChange={handleViewportChange}
          onOpenStory={handleOpenStory}
          highlightRef={highlightRef}
          viewport={viewport}
        />
      </section>

      <section
        ref={listRef}
        className={LIST_CLASS}
      >
        <h1 className={TITLE_CLASS}>{TITLE}</h1>
        <StoryGrid
          posts={visiblePosts}
          onHighlight={handleHighlight}
          onPrefetch={handlePrefetch}
        />
      </section>
    </main>
  )
}
