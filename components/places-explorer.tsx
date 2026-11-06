"use client"

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, ChevronDown, Grid2x2, Map as MapIcon, Search } from "lucide-react"
import type { Place } from "@/interfaces/post"

import { cn } from "@/lib/utils"
import { groupByArea, storyArea } from "@/lib/places"
import {
  PlacesMap,
  type MapHighlight,
  type MapViewport,
} from "@/components/places-map"
import { PendingTile } from "@/components/pending-tile"
import { StoryTile } from "@/components/story-tile"

type Props = {
  stories: Place[]
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
  "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

function matches(story: Place, tokens: string[]) {
  const haystack = ` ${normalize(
    `${story.name} ${story.area ?? ""} ${story.description}`
  )}`

  // Word starts only: "mission" should not find "decommissioned".
  return tokens.every((token) => haystack.includes(` ${token}`))
}

const GRID_CLASS = "grid grid-cols-1 gap-x-3 gap-y-6 px-4 sm:grid-cols-2 md:gap-x-6 md:gap-y-10 lg:grid-cols-3"

const PhotoGrid = memo(function PhotoGrid({
  stories,
  onPrefetch,
}: {
  stories: Place[]
  onPrefetch?: (slug: string) => void
}) {
  const finished = stories.filter((story) => story.status === "complete")
  const pending = stories.filter((story) => story.status === "pending")

  return (
    <div className="pb-16 pt-3 md:pb-24">
      {finished.length > 0 ? (
        <ul data-testid="story-list" className={GRID_CLASS}>
          {finished.map((story, index) => (
            <li key={story.slug}>
              <StoryTile
                story={story}
                sizes={TILE_SIZES}
                priority={index < 4}
                onPointerEnter={() => onPrefetch?.(story.slug)}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {pending.length > 0 ? (
        <section data-testid="places-pending" className={finished.length > 0 ? "mt-12 md:mt-16" : undefined}>
          <div className="mx-4 mb-5 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 border-t pt-4">
            <h2 className="font-serif text-3xl leading-none md:text-4xl">Photographed once, so far.</h2>
            <p className="text-muted-foreground">Archive photographs whose modern photographs are pending.</p>
          </div>
          <ul className={`${GRID_CLASS} lg:grid-cols-4`}>
            {pending.map((place) => (
              <li key={place.slug}>
                <PendingTile place={place} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
})

const ROW_CLASS = "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors"

// A place in the list. Choosing it finds it on the map; once chosen, it is the way into its story.
function StoryRow({
  story,
  chosen,
  onChoose,
  onHighlight,
}: {
  story: Place
  chosen?: boolean
  onChoose: (story: Place) => void
  onHighlight?: (slug: string | null) => void
}) {
  const picture = (
    <Image
      src={story.status === "pending" ? story.b_imageUrl : story.ba_imageUrl}
      alt=""
      width={story.w}
      height={story.h}
      sizes="96px"
      className="aspect-[3/2] w-24 shrink-0 bg-muted object-cover"
    />
  )

  return (
    <div
      data-testid="map-list-item"
      onPointerEnter={() => onHighlight?.(story.slug)}
      onPointerLeave={() => onHighlight?.(null)}
    >
      {chosen ? (
        <Link
          href={`/${story.slug}`}
          data-testid="map-selection"
          className={cn(ROW_CLASS, "group bg-muted ring-1 ring-accent")}
        >
          {picture}
          <span className="min-w-0 flex-1">
            <span data-testid="map-selection-name" className="block text-[15px] font-medium leading-snug">
              {story.name}
            </span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-[15px] text-muted-foreground underline-offset-4 group-hover:underline">
              {story.status === "pending" ? "Modern photograph pending" : "Open story"}
              <ArrowRight aria-hidden className="size-4" />
            </span>
          </span>
        </Link>
      ) : (
        <button
          type="button"
          className={cn(ROW_CLASS, "hover:bg-muted")}
          onClick={() => onChoose(story)}
          onFocus={() => onHighlight?.(story.slug)}
          onBlur={() => onHighlight?.(null)}
        >
          {picture}
          <span className="min-w-0">
            <span className="line-clamp-2 text-[15px] font-medium leading-snug">{story.name}</span>
            {story.status === "pending" ? <span className="block text-[15px] text-muted-foreground">Pending</span> : null}
          </span>
        </button>
      )}
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
      <h1 className="sr-only">Places</h1>
      <div className="tn-toolbar bg-background" />
      <div className="tn-fallback-list">
        <PhotoGrid stories={stories} />
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
  // An address can name a chosen place, so coming back from its story finds it still chosen.
  const [selected, setSelected] = useState<Place[] | null>(() => {
    const arrived = stories.find((story) => story.slug === searchParams.get("story"))
    return arrived ? [arrived] : null
  })
  const [mapFailed, setMapFailed] = useState(false)
  const highlightRef = useRef<MapHighlight | null>(null)
  const focusRef = useRef<((story: Place) => void) | null>(null)
  const fitAllRef = useRef<(() => void) | null>(null)
  const [visibleCount, setVisibleCount] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const [lead, setLead] = useState<string | null>(null)

  const areas = useMemo(() => groupByArea(stories), [stories])

  const filtered = useMemo(() => {
    const tokens = normalize(deferredQuery).split(/\s+/).filter(Boolean)

    return stories.filter(
      (story) =>
        (!area || storyArea(story) === area) &&
        matches(story, tokens)
    )
  }, [area, deferredQuery, stories])

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

  // A different set of places has no use for the old camera: the map frames what was found.
  const forgetCamera = (params: URLSearchParams) => {
    ;["lat", "lng", "z", "story"].forEach((key) => params.delete(key))
  }

  const setParam = (key: string, value: string, method: "push" | "replace") => {
    writeParams((params) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }

      if (key !== "view") {
        forgetCamera(params)
      }
    }, method)
  }

  const clearFilters = () => {
    setQuery("")
    writeParams((params) => {
      params.delete("q")
      params.delete("area")
      forgetCamera(params)
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

  // A row chooses its place on the map; the card that opens is the way into the story.
  const handleChoose = useCallback((story: Place) => {
    setSelected([story])
    focusRef.current?.(story)

    if (!window.matchMedia("(min-width: 1024px)").matches) {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
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
    listRef.current
      ?.querySelector<HTMLElement>('[data-testid="map-selection"]')
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

  // A single chosen place is part of the address, so coming back from its story finds it still chosen.
  useEffect(() => {
    const chosen = selected?.length === 1 ? selected[0].slug : null

    if (new URLSearchParams(window.location.search).get("story") !== chosen) {
      writeParams((params) => {
        if (chosen) {
          params.set("story", chosen)
        } else {
          params.delete("story")
        }
      }, "replace")
    }
  }, [selected, writeParams])

  // Under a phone's map, a chosen place out of reach leads the list, so it shows without being
  // repeated on the map. One already in view stays put, under the finger that chose it.
  useLayoutEffect(() => {
    const row = listRef.current?.querySelector('[data-testid="map-selection"]')
    const chosen = selected?.[0]?.slug ?? null

    if (!row || !chosen || !window.matchMedia("(max-width: 1023px)").matches) {
      setLead(null)
      return
    }

    const { top, height } = row.getBoundingClientRect()

    const inReach = top + window.scrollY + height <= window.innerHeight

    setLead((current) => (current === chosen || !inReach ? chosen : null))
  }, [selected])

  const listed = useMemo(
    () => (lead ? [...filtered].sort((a, b) => Number(b.slug === lead) - Number(a.slug === lead)) : filtered),
    [filtered, lead]
  )

  const hasFilter = Boolean(deferredQuery.trim() || area)
  const isEmpty = filtered.length === 0
  const finishedCount = filtered.filter((story) => story.status === "complete").length
  const pendingCount = filtered.length - finishedCount
  const resultLabel = `${finishedCount} ${finishedCount === 1 ? "story" : "stories"}${pendingCount ? `, ${pendingCount} pending` : ""}`

  return (
    <main className="flex-1">
      <div
        data-testid="places-toolbar"
        className="tn-toolbar flex flex-col justify-center gap-2 bg-background px-4 pb-3 pt-2 md:flex-row md:items-center md:gap-3 md:py-0"
      >
        <div className="flex items-baseline justify-between gap-4 md:contents">
          <h1 className="font-serif text-[2.5rem] leading-none md:mr-3 md:text-5xl">Places</h1>
          <span
            role="status"
            data-testid="places-count"
            className="text-[15px] tabular-nums text-muted-foreground md:order-last"
          >
            {resultLabel}
          </span>
        </div>
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
              setParam("q", event.target.value, "replace")
            }}
          />
        </div>
        <div className="flex min-w-0 items-center gap-2 md:contents">
          <div className="relative min-w-0 flex-1 md:flex-none">
          <select
            value={area}
            aria-label="Area"
            className={cn(controlClass, "w-full appearance-none pl-4 pr-9")}
            onChange={(event) => {
              setSelected(null)
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
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
          </div>
          <div className="flex shrink-0 rounded-full border border-input bg-popover p-0.5 md:order-last md:ml-auto">
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
          <EmptyState query={deferredQuery} area={area} hasFilter={hasFilter} onClear={clearFilters} />
        ) : (
          <PhotoGrid stories={filtered} onPrefetch={handlePrefetch} />
        )
      ) : (
        <div className="tn-map-view flex flex-col lg:flex-row-reverse" data-testid="map-view">
          <div className="tn-map relative h-[50svh] min-h-[20rem] min-w-0 shrink-0 lg:h-auto lg:flex-1 lg:shrink">
            <PlacesMap
              stories={filtered}
              viewport={viewport}
              selected={selected}
              highlightRef={highlightRef}
              focusRef={focusRef}
              fitAllRef={fitAllRef}
              onVisibleSlugsChange={(slugs) => setVisibleCount(slugs.length)}
              onViewportChange={handleViewportChange}
              onSelect={setSelected}
              onFail={setMapFailed}
            />

            {pendingCount > 0 && finishedCount > 0 ? (
              <p
                data-testid="map-key"
                className="pointer-events-none absolute bottom-2 left-2 z-[2] flex gap-3 rounded-full bg-black/75 px-3 py-1.5 text-[13px] text-white"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-full bg-white" />
                  Then and now
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-full border-2 border-white" />
                  Pending
                </span>
              </p>
            ) : null}

            {!isEmpty && visibleCount !== null && visibleCount < filtered.length ? (
              <button
                type="button"
                data-testid="map-show-all"
                className="absolute left-3 top-3 z-[2] inline-flex h-11 items-center rounded-full bg-popover px-4 text-[15px] shadow-[0_1px_6px_rgb(0_0_0/0.5)] transition-colors hover:bg-muted"
                onClick={() => {
                  setSelected(null)
                  fitAllRef.current?.()
                }}
              >
                All {filtered.length} places
              </button>
            ) : null}

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
              <div className="absolute inset-x-3 bottom-10 z-[2] mx-auto max-w-sm rounded-lg bg-popover px-4 py-3 text-center shadow-[0_6px_28px_rgb(0_0_0/0.5)]">
                <p className="text-[17px]">
                  {noMatchText(query, area)}
                </p>
                <button
                  type="button"
                  className="py-1 text-sm underline underline-offset-2"
                  onClick={clearFilters}
                >
                  Show all places
                </button>
              </div>
            ) : null}

          </div>
          <aside className="shrink-0 border-t lg:w-[23rem] lg:overflow-y-auto lg:border-r lg:border-t-0">
            {filtered.length > 0 ? (
              <ul ref={listRef} className="p-2">
                {listed.map((story) => (
                  <li key={story.slug}>
                    <StoryRow
                      story={story}
                      chosen={Boolean(selected?.some((other) => other.slug === story.slug))}
                      onChoose={handleChoose}
                      onHighlight={handleHighlight}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </aside>
        </div>
      )}
    </main>
  )
}

function noMatchText(query: string, area: string) {
  const within = area ? ` in ${area}` : ""
  return query.trim() ? `Nothing matches “${query.trim()}”${within}.` : `Nothing here${within}.`
}

function EmptyState({
  query,
  area,
  hasFilter,
  onClear,
}: {
  query: string
  area: string
  hasFilter: boolean
  onClear: () => void
}) {
  return (
    <div data-testid="places-empty" className="px-4 py-20 text-center">
      <p className="font-serif text-4xl leading-tight md:text-5xl">
        {noMatchText(query, area)}
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
