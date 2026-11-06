"use client"

import {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, List, Map as MapIcon, Search, X } from "lucide-react"

import {
  rememberStoryOrigin,
  replaceListUrl,
  SHOW_ALL_STORIES_EVENT,
  takeListReturn,
  trackListState,
} from "@/lib/story-return"
import { cn } from "@/lib/utils"
import { HomeMap, type HomeMapHandle } from "@/components/home-map"
import { PlaceRow, type PlaceSummary } from "@/components/place-row"

const STORIES_GROUP = "Stories"
const SEARCH_FIT_DELAY_MS = 350

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

function writeUrlParam(name: string, value: string | null) {
  const url = new URL(window.location.href)

  if (value) {
    url.searchParams.set(name, value)
  } else {
    url.searchParams.delete(name)
  }

  replaceListUrl(url)
}

const Row = memo(function Row({
  place,
  hidden,
  onPreview,
}: {
  place: PlaceSummary
  hidden: boolean
  onPreview: (slug: string | null) => void
}) {
  return (
    <li
      hidden={hidden}
      data-testid="story-card"
      onMouseEnter={() => onPreview(place.slug)}
      onMouseLeave={() => onPreview(null)}
      onFocus={() => onPreview(place.slug)}
      onBlur={() => onPreview(null)}
    >
      <PlaceRow place={place} />
    </li>
  )
})

export function PlacesBrowser({ places }: { places: PlaceSummary[] }) {
  const router = useRouter()
  const mapRef = useRef<HomeMapHandle>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasRestoredRef = useRef(false)
  const [restoreY, setRestoreY] = useState<number | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const pendingBarScrollRef = useRef(false)
  const [query, setQuery] = useState("")
  const [view, setView] = useState<"list" | "map">("list")
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set())
  const [visibleSlugs, setVisibleSlugs] = useState<Set<string> | null>(null)
  const [mapFailed, setMapFailed] = useState(false)
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    trackListState(() => ({
      openGroups: [...openGroups],
      visibleSlugs: visibleSlugs && [...visibleSlugs],
    }))
  }, [openGroups, visibleSlugs])

  // Everything a returning visitor left behind, before the first paint.
  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const listReturn = takeListReturn()

    // The URL only exists on the client, so it can't seed the initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(params.get("q") ?? "")
    setView(params.get("view") === "map" ? "map" : "list")

    if (listReturn) {
      setOpenGroups(new Set(listReturn.openGroups))
      // The map reports again once loaded; the page needs its height now.
      setVisibleSlugs(listReturn.visibleSlugs && new Set(listReturn.visibleSlugs))
      setRestoreY(listReturn.scrollY)
    } else if (params.get("view") === "map" || params.has("q")) {
      pendingBarScrollRef.current = true
    }
  }, [])

  // Waits for the restored list, including a deferred search, to be on the page.
  useLayoutEffect(() => {
    if (
      restoreY !== null &&
      !hasRestoredRef.current &&
      deferredQuery === query
    ) {
      hasRestoredRef.current = true
      window.scrollTo(0, restoreY)
    }
  }, [restoreY, deferredQuery, query])

  useLayoutEffect(() => {
    if (pendingBarScrollRef.current) {
      pendingBarScrollRef.current = false
      // Brings the search bar under the header, so the view below fills the screen.
      const start = window.matchMedia("(min-width: 1024px)").matches
        ? document.getElementById("places")
        : barRef.current?.previousElementSibling
      // After the frame, as the router settles its own scroll on navigation.
      requestAnimationFrame(() => start?.scrollIntoView({ block: "start" }))
    }
  })

  const groups = useMemo(() => {
    const byName = new Map<string, PlaceSummary[]>([[STORIES_GROUP, []]])

    places.forEach((place) => {
      const name = place.area ?? STORIES_GROUP
      byName.set(name, [...(byName.get(name) ?? []), place])
    })

    return [...byName.entries()].map(([name, members]) => ({ name, members }))
  }, [places])

  const searchIndex = useMemo(
    () =>
      new Map(
        places.map((place) => [
          place.slug,
          normalize(`${place.name} ${place.area ?? ""}`),
        ])
      ),
    [places]
  )

  const needle = normalize(deferredQuery.trim())

  const matches = useMemo(() => {
    if (!needle) {
      return null
    }

    return new Set(
      places
        .filter((place) => searchIndex.get(place.slug)?.includes(needle))
        .map((place) => place.slug)
    )
  }, [needle, places, searchIndex])

  // A search decides what is listed; otherwise the map view does.
  const shown = matches ?? visibleSlugs
  const isNarrowed = shown !== null
  const shownCount = shown ? shown.size : places.length

  // Only a change of search moves the map, never a search or map view that
  // arrived in the URL together.
  const appliedMatchesRef = useRef<Set<string> | null>(null)
  const hasAppliedSearchRef = useRef(false)
  useEffect(() => {
    if (matches === appliedMatchesRef.current) {
      return
    }

    const timer = window.setTimeout(() => {
      const arrivedWithView =
        !hasAppliedSearchRef.current &&
        new URLSearchParams(window.location.search).has("lat")

      appliedMatchesRef.current = matches
      hasAppliedSearchRef.current = true
      mapRef.current?.setActive(matches ? [...matches] : null, !arrivedWithView)
    }, SEARCH_FIT_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [matches])

  const handleVisibleSlugsChange = useCallback(
    (slugs: string[], total: number, movedByVisitor: boolean) => {
      // A sticky map can move while the list is scrolled far down.
      const listTop = listRef.current?.getBoundingClientRect().top ?? 0
      if (movedByVisitor && listTop < 0) {
        window.scrollBy({ top: listTop - 136 })
      }

      startTransition(() => {
        setVisibleSlugs(slugs.length === total ? null : new Set(slugs))
      })
    },
    []
  )

  const handleSelect = useCallback(
    (slug: string) => {
      rememberStoryOrigin(slug)
      router.push(`/${slug}`)
    },
    [router]
  )

  const handlePreview = useCallback((slug: string | null) => {
    mapRef.current?.preview(slug)
  }, [])

  const updateQuery = (value: string) => {
    setQuery(value)
    writeUrlParam("q", value.trim() ? value : null)
  }

  const updateView = (next: "list" | "map") => {
    pendingBarScrollRef.current = true
    setView(next)
    writeUrlParam("view", next === "map" ? "map" : null)
  }

  const showAll = useCallback(() => {
    setQuery("")
    writeUrlParam("q", null)
    // The map may not have started yet, so the URL can't wait for it.
    ;["lat", "lng", "z"].forEach((param) => writeUrlParam(param, null))
    setVisibleSlugs(null)
    mapRef.current?.showAll()
  }, [])

  useEffect(() => {
    const reset = () => {
      showAll()
      window.scrollTo(0, 0)
    }

    window.addEventListener(SHOW_ALL_STORIES_EVENT, reset)
    return () => window.removeEventListener(SHOW_ALL_STORIES_EVENT, reset)
  }, [showAll])

  // Any link leaving the page keeps the place to come back to.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button) {
        return
      }

      const link = (event.target as Element).closest?.("a")
      const href = link?.getAttribute("href")

      if (!href?.startsWith("/") || href === "/" || href.startsWith("/#")) {
        return
      }

      const path = href.slice(1).split(/[?#]/)[0]
      rememberStoryOrigin(path)
    }

    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  const toggleGroup = (name: string, isOpen: boolean) => {
    setOpenGroups((current) => {
      const next = new Set(current)

      if (isOpen) {
        next.add(name)
      } else {
        next.delete(name)
      }

      return next
    })
  }

  return (
    <section
      id="places"
      aria-labelledby="places-title"
      className="mt-12 border-t border-border/70 lg:mt-16"
    >
      <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="min-w-0">
          <div className="px-4 pb-3 pt-6">
            <h2
              id="places-title"
              className="font-serif text-3xl tracking-tight sm:text-4xl"
            >
              Places
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
              The six stories above, and 300 sample places. Sample names and
              locations are fictional and reuse the same photographs.
            </p>
          </div>

          <div data-places-start />
          <div
            ref={barRef}
            className="sticky top-14 z-20 flex gap-2 border-b border-border/70 bg-background px-4 py-3"
          >
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder={`Search ${places.length} places`}
                aria-label="Search places"
                data-testid="places-search"
                data-filled={Boolean(query)}
                className="h-11 w-full rounded-sm border border-input bg-card pl-9 pr-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring data-[filled=true]:pr-10 [&::-webkit-search-cancel-button]:appearance-none"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    updateQuery("")
                    inputRef.current?.focus()
                  }}
                  className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                >
                  <X aria-hidden className="size-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              data-testid="places-view-toggle"
              onClick={() => updateView(view === "map" ? "list" : "map")}
              className="flex h-11 shrink-0 items-center gap-2 rounded-sm border border-input bg-card px-3 text-sm font-medium lg:hidden"
            >
              {view === "map" ? (
                <>
                  <List aria-hidden className="size-4" />
                  List
                </>
              ) : (
                <>
                  <MapIcon aria-hidden className="size-4" />
                  Map
                </>
              )}
            </button>
          </div>

          <p className="sr-only" role="status" data-testid="places-status">
            {shownCount} of {places.length} places
          </p>

          <div
            ref={listRef}
            data-testid="story-list"
            className={cn(
              "px-2 pb-10 pt-2 [overflow-anchor:none] lg:block",
              view === "map" && "hidden"
            )}
          >
            {!matches && visibleSlugs && shownCount > 0 && (
              <button
                type="button"
                data-testid="list-show-all"
                onClick={showAll}
                className="flex h-11 items-center gap-2 rounded-sm px-2 text-sm font-medium tabular-nums lg:hidden"
              >
                {shownCount} of {places.length} in this map view
                <X aria-hidden className="size-4" />
              </button>
            )}

            {shownCount === 0 && (
              <div className="px-2 py-8" data-testid="places-empty">
                <p className="font-serif text-xl">
                  {matches
                    ? `Nothing matches “${query.trim()}”.`
                    : "No places in this part of the map."}
                </p>
                <button
                  type="button"
                  onClick={showAll}
                  className="mt-2 flex h-11 items-center rounded-sm text-sm font-medium underline underline-offset-4"
                >
                  Show all places
                </button>
              </div>
            )}

            {groups.map((group) => {
              const count = shown
                ? group.members.filter((place) => shown.has(place.slug)).length
                : group.members.length

              return (
                <details
                  key={group.name}
                  data-testid="places-group"
                  hidden={count === 0}
                  open={isNarrowed || openGroups.has(group.name)}
                  onToggle={(event) => {
                    if (!isNarrowed) {
                      toggleGroup(group.name, event.currentTarget.open)
                    }
                  }}
                >
                  <summary
                    onClick={(event) => {
                      if (isNarrowed) {
                        event.preventDefault()
                      }
                    }}
                    className="flex min-h-12 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm font-medium hover:bg-muted"
                  >
                    <ChevronRight
                      aria-hidden
                      className="tn-disclosure size-4 shrink-0 text-muted-foreground transition-[rotate] duration-150"
                    />
                    <span className="flex-1">{group.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {count}
                    </span>
                  </summary>
                  <ul className="pb-2">
                    {group.members.map((place) => (
                      <Row
                        key={place.slug}
                        place={place}
                        hidden={shown !== null && !shown.has(place.slug)}
                        onPreview={handlePreview}
                      />
                    ))}
                  </ul>
                </details>
              )
            })}
          </div>
        </div>

        <div
          data-testid="places-map-pane"
          className={cn(
            "relative h-[calc(100svh-7.75rem)] min-h-80 bg-muted lg:sticky lg:top-14 lg:block lg:h-[calc(100svh-3.5rem)]",
            view === "list" && "hidden"
          )}
        >
          <HomeMap
            ref={mapRef}
            spots={places}
            onVisibleSlugsChange={handleVisibleSlugsChange}
            onSelect={handleSelect}
            onFailure={() => setMapFailed(true)}
          />
          {matches?.size === 0 && (
            <div className="absolute inset-x-3 bottom-3 z-10 rounded-sm bg-background px-3 py-2 shadow-md lg:hidden">
              <p className="text-sm">Nothing matches “{query.trim()}”.</p>
              <button
                type="button"
                onClick={showAll}
                className="flex h-11 items-center rounded-sm text-sm font-medium underline underline-offset-4"
              >
                Show all places
              </button>
            </div>
          )}
          {mapFailed && (
            <p className="absolute left-3 right-16 top-3 z-10 rounded-sm bg-background px-3 py-2 text-sm shadow-md">
              Map tiles could not load. Every place is still in the list.
            </p>
          )}
          {!matches && visibleSlugs && (
            <button
              type="button"
              data-testid="map-show-all"
              aria-label={`Show all ${places.length} places`}
              onClick={() => mapRef.current?.showAll()}
              className="absolute bottom-3 left-3 z-10 flex h-11 items-center gap-2 rounded-sm bg-background px-3 text-sm font-medium tabular-nums shadow-md transition-colors hover:bg-muted"
            >
              {visibleSlugs.size} of {places.length}
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
