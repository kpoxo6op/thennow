"use client"

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"

import {
  rememberStoryOrigin,
  restoreListScroll,
  SHOW_ALL_STORIES_EVENT,
} from "@/lib/story-return"
import { HomeMap, type HomeMapHandle, type MapSpot } from "@/components/home-map"

type Props = {
  spots: MapSpot[]
  hasSampleContent: boolean
}

// The first row is what a visitor sees on arrival.
const EAGER_CARDS = 3

const StoryCard = memo(function StoryCard({
  spot,
  hidden,
  priority,
}: {
  spot: MapSpot
  hidden: boolean
  priority: boolean
}) {
  return (
    <li hidden={hidden} data-testid="story-card">
      <Link
        href={`/${spot.slug}`}
        onClick={() => rememberStoryOrigin(spot.slug)}
        className="group block rounded-sm"
      >
        <span className="relative block aspect-[3/2] overflow-hidden rounded-sm bg-muted">
          <Image
            src={spot.ba_imageUrl}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 1536px) 15vw, (min-width: 1280px) 20vw, (min-width: 1024px) 28vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025]"
          />
        </span>
        <span className="mt-2 line-clamp-2 font-serif text-[0.9375rem] leading-snug text-foreground/90 group-hover:text-foreground sm:text-base">
          {spot.name}
        </span>
      </Link>
    </li>
  )
})

export function HomeExplorer({ spots, hasSampleContent }: Props) {
  const router = useRouter()
  const mapRef = useRef<HomeMapHandle>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [visibleSlugs, setVisibleSlugs] = useState<Set<string> | null>(null)

  useLayoutEffect(() => {
    restoreListScroll()
  }, [])

  useEffect(() => {
    const showAll = () => {
      mapRef.current?.showAll()
      window.scrollTo(0, 0)
    }

    window.addEventListener(SHOW_ALL_STORIES_EVENT, showAll)
    return () => window.removeEventListener(SHOW_ALL_STORIES_EVENT, showAll)
  }, [])

  const handleVisibleSlugsChange = useCallback(
    (slugs: string[], total: number, movedByVisitor: boolean) => {
      // A sticky map can move while the list is scrolled far down.
      const listTop = listRef.current?.getBoundingClientRect().top ?? 0
      if (movedByVisitor && listTop < 0) {
        window.scrollBy({ top: listTop - 72 })
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

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr]">
      <header className="px-4 pb-5 pt-5 sm:px-6 lg:col-start-2 lg:px-8 lg:pb-8 lg:pt-10">
        <h1 className="text-balance font-serif text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl">
          New Zealand Then and Now
        </h1>
        {hasSampleContent && (
          <p className="mt-2 text-sm text-muted-foreground">
            This preview includes sample content.
          </p>
        )}
      </header>

      <div className="relative h-[46svh] min-h-64 bg-muted lg:sticky lg:top-14 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:h-[calc(100svh-3.5rem)]">
        <HomeMap
          ref={mapRef}
          spots={spots}
          onVisibleSlugsChange={handleVisibleSlugsChange}
          onSelect={handleSelect}
        />
        {visibleSlugs && (
          <button
            type="button"
            data-testid="map-show-all"
            aria-label={`Show all ${spots.length} stories`}
            onClick={() => mapRef.current?.showAll()}
            className="absolute bottom-3 left-3 z-10 flex h-11 items-center gap-2 rounded-sm bg-background px-3 text-sm font-medium tabular-nums shadow-md transition-colors hover:bg-muted"
          >
            {visibleSlugs.size} / {spots.length}
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>

      <section className="px-4 pb-16 pt-6 sm:px-6 lg:col-start-2 lg:px-8 lg:pt-0">
        <h2 className="sr-only">Stories</h2>
        <ul
          ref={listRef}
          data-testid="story-list"
          className="grid grid-cols-2 [overflow-anchor:none] gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-2 lg:gap-y-7 xl:grid-cols-3 2xl:grid-cols-4"
        >
          {spots.map((spot, index) => (
            <StoryCard
              key={spot.slug}
              spot={spot}
              priority={index < EAGER_CARDS}
              hidden={visibleSlugs !== null && !visibleSlugs.has(spot.slug)}
            />
          ))}
        </ul>
      </section>
    </div>
  )
}
