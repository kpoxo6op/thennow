"use client"

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Grid2x2, Map as MapIcon, Search, X } from "lucide-react"
import type { StorySummary } from "@/interfaces/post"

import { cn } from "@/lib/utils"
import { groupByArea, storyArea, type PlaceGroup } from "@/lib/places"
import {
  PlacesMap,
  type MapHighlight,
  type MapViewport,
} from "@/components/places-map"
import { StoryTile } from "@/components/story-tile"

type Props = {
  stories: StorySummary[]
}

const VIEWPORT_LIMITS = {
  minLat: -37.2,
  maxLat: -36.55,
  minLng: 174.25,
  maxLng: 175.05,
  minZoom: 8,
  maxZoom: 16,
}

const TILE_SIZES =
  "(min-width: 1024px) 33vw, 50vw"

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

function matches(story: StorySummary, tokens: string[]) {
  const haystack = ` ${normalize(
    `${story.name} ${story.area ?? ""} ${story.description}`
  )}`

  // Word starts only: "mission" should not find "decommissioned".
  return tokens.every((token) => haystack.includes(` ${token}`))
}

const PhotoGroups = memo(function PhotoGroups({
  groups,
  onPrefetch,
}: {
  groups: PlaceGroup[]
  onPrefetch?: (slug: string) => void
}) {
  return (
    <div className="space-y-10 px-4 pb-16 pt-5 md:space-y-16 md:pb-24 md:pt-6">
      {groups.map((group, groupIndex) => (
          <section key={group.id} className="tn-section">
            <div className="mb-4 flex items-baseline justify-between gap-4 border-t pt-3 md:mb-5">
              <h2 className="font-serif text-3xl leading-none md:text-5xl">
                {group.title}
              </h2>
              <span className="text-[15px] tabular-nums text-muted-foreground">
                {group.stories.length}
              </span>
            </div>
            <ul
              data-testid="story-list"
              className="grid grid-cols-2 gap-x-3 gap-y-6 md:gap-x-6 md:gap-y-10 lg:grid-cols-3"
            >
              {group.stories.map((story, storyIndex) => (
                <li key={story.slug}>
                  <StoryTile
                    story={story}
                    sizes={TILE_SIZES}
                    priority={groupIndex === 0 && storyIndex < 4}
                    onPointerEnter={() => onPrefetch?.(story.slug)}
                  />
                </li>
              ))}
            </ul>
          </section>
      ))}
    </div>
  )
})

function StoryRow({
  story,
  onHighlight,
}: {
  story: StorySummary
  onHighlight?: (slug: string | null) => void
}) {
  return (
    <Link
      href={`/${story.slug}`}
      prefetch={false}
      data-testid="map-list-item"
      className="group flex items-center gap-3 p-2 transition-colors hover:bg-muted"
      onPointerEnter={() => onHighlight?.(story.slug)}
      onPointerLeave={() => onHighlight?.(null)}
      onFocus={() => onHighlight?.(story.slug)}
      onBlur={() => onHighlight?.(null)}
    >
      <Image
        src={story.ba_imageUrl}
        alt=""
        width={story.w}
        height={story.h}
        sizes="96px"
        className="aspect-[3/2] w-24 shrink-0 bg-muted object-cover"
      />
      <span className="line-clamp-2 text-[15px] font-medium leading-snug">
        {story.name}
      </span>
    </Link>
  )
}

function PlacesTitle({ label, hidden }: { label: string; hidden?: boolean }) {
  return (
    <div className={hidden ? "sr-only" : "flex items-baseline justify-between gap-4 px-4 pb-3 pt-6 md:pb-4 md:pt-10"}>
      <h1 className="font-serif text-6xl leading-none md:text-8xl">Places</h1>
      <span role="status" data-testid="places-count" className="text-[15px] tabular-nums text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

const controlClass =
  "h-11 rounded-full border border-input bg-popover text-[15px] md:h-10 md:text-sm"

// The server's first paint: every place, before URL state is known.
export function PlacesFallback({ stories }: Props) {
  return (
    <main className="tn-enter flex-1">
      {/* A link to a filter or the map shouldn't flash the full list before hydrating. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `if(/[?&](q|area|view)=/.test(location.search))document.documentElement.classList.add("tn-deep-link")`,
        }}
      />
      <div className="tn-fallback-list">
        <PlacesTitle label={`${stories.length} places`} />
      </div>
      <div className="tn-toolbar bg-background" />
      <div className="tn-fallback-list">
        <PhotoGroups groups={groupByArea(stories)} />
      </div>
    </main>
  )
}

export function PlacesExplorer({ stories }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const view = searchParams.get("view") === "map" ? "map" : "photos"
  const area = searchParams.get("area") ?? ""
  const queryParam = searchParams.get("q") ?? ""

  const [query, setQuery] = useState(queryParam)
  const [syncedParam, setSyncedParam] = useState(queryParam)

  if (queryParam !== syncedParam) {
    setSyncedParam(queryParam)
    setQuery(queryParam)
  }

  const deferredQuery = useDeferredValue(query)
  const [visibleSlugs, setVisibleSlugs] = useState<string[] | null>(null)
  const [selected, setSelected] = useState<StorySummary[] | null>(null)
  const [mapFailed, setMapFailed] = useState(false)
  const highlightRef = useRef<MapHighlight | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const selectedRef = useRef<HTMLDivElement | null>(null)

  const areas = useMemo(() => groupByArea(stories), [stories])

  const filtered = useMemo(() => {
    const tokens = normalize(deferredQuery).split(/\s+/).filter(Boolean)

    return stories.filter(
      (story) =>
        (!area || storyArea(story) === area) &&
        matches(story, tokens)
    )
  }, [area, deferredQuery, stories])

  const groups = useMemo(() => groupByArea(filtered), [filtered])

  const writeParams = useCallback(
    (change: (params: URLSearchParams) => void, method: "push" | "replace") => {
      const params = new URLSearchParams(window.location.search)
      change(params)
      const next = params.toString()
      const url = next ? `${pathname}?${next}` : pathname

      if (method === "push") {
        window.history.pushState(null, "", url)
      } else {
        window.history.replaceState(null, "", url)
      }
    },
    [pathname]
  )

  const setParam = (key: string, value: string, method: "push" | "replace") => {
    writeParams((params) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }, method)
  }

  const clearFilters = () => {
    setQuery("")
    writeParams((params) => {
      params.delete("q")
      params.delete("area")
    }, "replace")
    inputRef.current?.focus()
  }

  const viewport = useMemo(() => {
    const params = new URLSearchParams(search)
    const lat = Number(params.get("lat"))
    const lng = Number(params.get("lng"))
    const z = Number(params.get("z"))

    if (
      params.has("lat") &&
      params.has("lng") &&
      params.has("z") &&
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

  const handleViewportChange = useCallback(
    (next: MapViewport) => {
      // A map settling after navigation must not rewrite another page's URL.
      if (window.location.pathname !== pathname) {
        return
      }

      writeParams((params) => {
        params.set("lat", String(next.lat))
        params.set("lng", String(next.lng))
        params.set("z", String(next.z))
      }, "replace")
    },
    [pathname, writeParams]
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
    if (!selected) {
      return
    }

    const previousFocus = document.activeElement
    selectedRef.current
      ?.querySelector("a")
      ?.focus({ preventScroll: true })

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null)
      }
    }

    window.addEventListener("keydown", closeOnEscape)

    return () => {
      window.removeEventListener("keydown", closeOnEscape)

      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [selected])

  const inView = useMemo(() => {
    if (!visibleSlugs) {
      return filtered
    }

    const slugs = new Set(visibleSlugs)
    return filtered.filter((story) => slugs.has(story.slug))
  }, [filtered, visibleSlugs])

  const hasFilter = Boolean(deferredQuery.trim() || area)
  const isEmpty = filtered.length === 0
  const resultLabel = `${filtered.length} ${filtered.length === 1 ? "place" : "places"}`

  return (
    <main className="flex-1">
      <PlacesTitle label={resultLabel} hidden={view === "map"} />
      <div
        data-testid="places-toolbar"
        className="tn-toolbar flex flex-col justify-center gap-2 bg-background px-4 pb-2.5 md:flex-row md:items-center md:pb-3 md:pt-1"
      >
        <div className="relative min-w-0 flex-1 md:max-w-md">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            aria-label="Search places"
            placeholder="Search places"
            className={cn(
              controlClass,
              "w-full pl-10 pr-4 placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:cursor-pointer"
            )}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelected(null)
              setVisibleSlugs(null)
              setParam("q", event.target.value, "replace")
            }}
          />
        </div>
        <div className="flex min-w-0 items-center gap-2 md:contents">
          <select
            value={area}
            aria-label="Area"
            className={cn(controlClass, "min-w-0 flex-1 px-3 md:w-auto md:flex-none")}
            onChange={(event) => {
              setSelected(null)
              setVisibleSlugs(null)
              setParam("area", event.target.value, "replace")
              window.scrollTo(0, 0)
            }}
          >
            <option value="">All areas</option>
            {areas.map((group) => (
              <option key={group.id} value={group.id}>
                {group.title}
              </option>
            ))}
          </select>
          <div className="flex shrink-0 rounded-full border border-input bg-popover p-0.5 md:ml-auto">
            {(
              [
                ["photos", "Photos", Grid2x2],
                ["map", "Map", MapIcon],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                className={cn(
                  "flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[15px] transition-colors md:h-9 md:text-sm",
                  view === value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => {
                  if (view === value) {
                    return
                  }

                  setSelected(null)
                  setParam("view", value === "map" ? "map" : "", "push")
                  window.scrollTo(0, 0)
                }}
              >
                <Icon aria-hidden className="hidden size-4 min-[360px]:block" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "photos" ? (
        isEmpty ? (
          <EmptyState query={deferredQuery} hasFilter={hasFilter} onClear={clearFilters} />
        ) : (
          <PhotoGroups groups={groups} onPrefetch={handlePrefetch} />
        )
      ) : (
        <div className="tn-map-view flex" data-testid="map-view">
          <aside className="hidden w-[23rem] shrink-0 overflow-y-auto border-r lg:block">
            {inView.length > 0 ? (
              <ul className="p-2">
                {inView.map((story) => (
                  <li key={story.slug}>
                    <StoryRow story={story} onHighlight={handleHighlight} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-[17px] text-muted-foreground">
                {isEmpty ? "No places match." : "No places in this part of the map."}
              </p>
            )}
          </aside>
          <div className="tn-map relative min-w-0 flex-1">
            <PlacesMap
              stories={filtered}
              viewport={viewport}
              selected={selected}
              highlightRef={highlightRef}
              onVisibleSlugsChange={setVisibleSlugs}
              onViewportChange={handleViewportChange}
              onSelect={setSelected}
              onFail={setMapFailed}
            />

            {mapFailed ? (
              <p
                role="alert"
                data-testid="map-failure"
                className="absolute inset-x-3 top-3 z-[2] mx-auto max-w-md rounded-lg bg-popover px-4 py-3 pr-14 text-sm shadow-[0_6px_28px_rgb(0_0_0/0.5)]"
              >
                The base map didn&apos;t load. The places still work here, or{" "}
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => setParam("view", "", "push")}
                >
                  browse the photos
                </button>
                .
              </p>
            ) : null}

            {isEmpty ? (
              <div className="absolute inset-x-3 top-3 z-[2] mx-auto max-w-sm rounded-lg bg-popover px-4 py-3 text-center shadow-[0_6px_28px_rgb(0_0_0/0.5)]">
                <p className="text-[17px]">No places match.</p>
                <button
                  type="button"
                  className="py-1 text-sm underline underline-offset-2"
                  onClick={clearFilters}
                >
                  Show all places
                </button>
              </div>
            ) : null}

            {selected ? (
              <div
                ref={selectedRef}
                data-testid="map-selection"
                className="absolute inset-x-2 bottom-2 z-[2] max-h-[60%] overflow-y-auto rounded-lg bg-popover shadow-[0_6px_28px_rgb(0_0_0/0.55)] sm:left-auto sm:right-3 sm:bottom-10 sm:w-[22rem]"
              >
                <button
                  type="button"
                  aria-label="Close"
                  className="absolute right-1 top-1 z-[1] flex size-10 items-center justify-center rounded-full bg-popover/90"
                  onClick={() => setSelected(null)}
                >
                  <X aria-hidden className="size-4" />
                </button>
                {selected.map((story) => (
                  <Link
                    key={story.slug}
                    href={`/${story.slug}`}
                    className="group flex items-center gap-3 p-2 pr-11"
                  >
                    <Image
                      src={story.ba_imageUrl}
                      alt=""
                      width={story.w}
                      height={story.h}
                      sizes="144px"
                      className="aspect-[3/2] w-36 shrink-0 bg-muted object-cover"
                    />
                    <span className="min-w-0 text-[17px] font-medium leading-snug underline-offset-4 group-hover:underline">
                      {story.name}
                      <ArrowRight aria-hidden className="ml-1 inline size-4" />
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </main>
  )
}

function EmptyState({
  query,
  hasFilter,
  onClear,
}: {
  query: string
  hasFilter: boolean
  onClear: () => void
}) {
  return (
    <div data-testid="places-empty" className="px-4 py-20 text-center">
      <p className="font-serif text-4xl leading-tight md:text-5xl">
        {query.trim() ? `Nothing matches “${query.trim()}”.` : "Nothing here."}
      </p>
      {hasFilter ? (
        <button
          type="button"
          className="mt-2 py-2 underline underline-offset-4"
          onClick={onClear}
        >
          Show all places
        </button>
      ) : null}
    </div>
  )
}
