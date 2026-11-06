"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"

import PostType from "@/interfaces/post"
import { STORY_TRIM } from "@/lib/places"
import { CompareStage } from "@/components/compare-stage"
import { SOURCE_LINE, toSections } from "@/components/Desc"
import { ResetScroll } from "@/components/reset-scroll"
import { SeamTile } from "@/components/seam-tile"

export type StoryLink = Pick<PostType, "name" | "slug" | "b_imageUrl" | "a_imageUrl" | "w" | "h" | "sample">

interface PostProps {
  post: PostType
  next?: StoryLink
  nearby: (StoryLink & { km: number })[]
}

const DEFAULT_POSITION = 50
const ALL_THEN = 100
const ALL_NOW = 0
const GLIDE_MS = 520

function clampPosition(position: number) {
  return Math.min(100, Math.max(0, position))
}

function parsePositionParam(positionParam: string | null) {
  if (!positionParam) {
    return DEFAULT_POSITION
  }

  const parsedPosition = Number(positionParam)

  if (!Number.isFinite(parsedPosition)) {
    return DEFAULT_POSITION
  }

  return clampPosition(parsedPosition)
}

function ease(t: number) {
  return 1 - (1 - t) ** 3
}

function distanceLabel(km: number) {
  return km < 1 ? "Under 1 km away" : `${Math.round(km)} km away`
}

function coordinates({ lat, lng }: PostType["location"]) {
  const ns = lat < 0 ? "S" : "N"
  const ew = lng < 0 ? "W" : "E"

  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`
}

// The first sentence of a passage is its caption; the rest is reading.
function ChapterWords({ lines }: { lines: string[] }) {
  const words = lines.filter((line) => !SOURCE_LINE.test(line))
  const sources = lines.filter((line) => SOURCE_LINE.test(line))
  const [lead, ...rest] = words

  return (
    <div className="space-y-4">
      {lead ? <p className="font-serif text-[1.75rem] leading-[1.15] md:text-[2rem]">{lead}</p> : null}
      {rest.map((line) => (
        <p key={line} className="tn-reading text-lg leading-relaxed md:text-xl">
          {line}
        </p>
      ))}
      {sources.map((source) => (
        <p key={source} className="text-[15px] leading-snug text-muted-foreground">
          <span className="block">Source</span>
          <a
            href={`https://${source}`}
            target="_blank"
            rel="noreferrer"
            className="break-all text-foreground underline underline-offset-4"
          >
            {source}
          </a>
        </p>
      ))}
    </div>
  )
}

export default function Post({ post, next, nearby }: PostProps) {
  const [position, setPosition] = useState(DEFAULT_POSITION)
  const glideRef = useRef<number | null>(null)
  const stageAnchorRef = useRef<HTMLDivElement>(null)

  const stopGlide = useCallback(() => {
    if (glideRef.current !== null) {
      cancelAnimationFrame(glideRef.current)
      glideRef.current = null
    }
  }, [])

  const applyPosition = useCallback(
    (next: number) => {
      stopGlide()
      setPosition(clampPosition(next))
    },
    [stopGlide]
  )

  // The legend and the years move the line for you, so each photograph can be seen whole.
  const glideTo = useCallback(
    (target: number, from: number) => {
      stopGlide()

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setPosition(target)
        return
      }

      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / GLIDE_MS)
        setPosition(from + (target - from) * ease(t))
        glideRef.current = t < 1 ? requestAnimationFrame(step) : null
      }

      glideRef.current = requestAnimationFrame(step)
    },
    [stopGlide]
  )

  useEffect(() => stopGlide, [stopGlide])

  useEffect(() => {
    const syncPositionFromUrl = () => {
      const url = new URL(window.location.href)
      const nextPosition = parsePositionParam(url.searchParams.get("p"))

      setPosition((currentPosition) => {
        if (Math.abs(currentPosition - nextPosition) < 0.01) {
          return currentPosition
        }

        return nextPosition
      })
    }

    syncPositionFromUrl()
    window.addEventListener("popstate", syncPositionFromUrl)

    return () => {
      window.removeEventListener("popstate", syncPositionFromUrl)
    }
  }, [])

  useEffect(() => {
    // A glide reports where it lands, not every frame along the way.
    if (glideRef.current !== null) {
      return
    }

    const url = new URL(window.location.href)
    const roundedPosition = Math.round(position)

    if (roundedPosition === DEFAULT_POSITION) {
      url.searchParams.delete("p")
    } else {
      url.searchParams.set("p", String(roundedPosition))
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl)
    }
  }, [position])

  const sections = toSections(post.description)
  const dated = sections.filter((section) => section.year)
  const undated = sections.filter((section) => !section.year)
  const thenYear = dated[0]?.year
  const nowYear = dated.length > 1 ? dated[dated.length - 1]?.year : undefined
  const yearsApart = thenYear && nowYear ? Number(nowYear) - Number(thenYear) : undefined
  const mapHref = `/places?view=map&lat=${post.location.lat}&lng=${post.location.lng}&z=15`
  const rounded = Math.round(position)

  const showWhole = (target: number) => {
    glideTo(rounded === target ? DEFAULT_POSITION : target, position)
  }

  // From further down the page, a year also brings the comparison back into view.
  const showWholeFromWords = (target: number) => {
    glideTo(target, position)
    const anchor = stageAnchorRef.current

    if (anchor && anchor.getBoundingClientRect().bottom < 0 && getComputedStyle(anchor).position !== "sticky") {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
    }
  }

  const legendClass =
    "inline-flex h-11 items-center gap-1.5 text-[15px] underline-offset-4 transition-colors hover:underline aria-pressed:font-medium aria-pressed:text-accent"

  const photos = [
    { label: "then", year: thenYear, src: post.b_imageUrl, target: ALL_THEN, section: dated[0] },
    { label: "now", year: nowYear, src: post.a_imageUrl, target: ALL_NOW, section: dated.length > 1 ? dated[dated.length - 1] : undefined },
  ]

  return (
    <main
      className="tn-story tn-enter flex-1"
      style={{ "--ratio": post.w / post.h } as React.CSSProperties}
    >
      <ResetScroll />
      <div>
        <div ref={stageAnchorRef} className="tn-story-pin">
          <div className="relative">
            <CompareStage
              name={post.name}
              thenSrc={post.b_imageUrl}
              nowSrc={post.a_imageUrl}
              ratio={post.w / post.h}
              position={position}
              onPositionChange={applyPosition}
              onInteract={stopGlide}
              priority
              className="tn-story-stage"
            />
            {post.sample ? (
              <span className="tn-story-edge pointer-events-none absolute inset-x-0 top-3 flex">
                <span className="ml-3 rounded-full bg-black/75 px-3 py-1 text-sm text-white">
                  Sample place<span className="hidden sm:inline">, placeholder photographs</span>
                </span>
              </span>
            ) : null}
          </div>
          <div className="tn-story-edge flex h-11 items-center justify-between">
            <button
              type="button"
              data-testid="story-show-then"
              aria-pressed={rounded === ALL_THEN}
              aria-label={`Show the whole ${thenYear ?? "then"} photograph`}
              className={legendClass}
              onClick={() => showWhole(ALL_THEN)}
            >
              <span className="text-muted-foreground">then</span>
              {thenYear ? <span className="font-serif text-[1.375rem] leading-none">{thenYear}</span> : null}
            </button>
            <button
              type="button"
              data-testid="story-show-now"
              aria-pressed={rounded === ALL_NOW}
              aria-label={`Show the whole ${nowYear ?? "now"} photograph`}
              className={legendClass}
              onClick={() => showWhole(ALL_NOW)}
            >
              <span className="text-muted-foreground">now</span>
              {nowYear ? <span className="font-serif text-[1.375rem] leading-none">{nowYear}</span> : null}
            </button>
          </div>
        </div>

        <article className="tn-story-edge pb-14 pt-3 md:pt-1">
          <header className="flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-8">
            <h1 className="text-balance font-serif text-[2.25rem] leading-[1.05] sm:text-[2.5rem] md:text-[3.25rem]">{post.name}</h1>
            {yearsApart ? (
              <p className="shrink-0 tabular-nums text-muted-foreground">{yearsApart} years apart</p>
            ) : null}
          </header>

          {post.sample ? (
            <div className="mt-6 max-w-2xl space-y-3 border-l-2 border-accent pl-4">
              <p className="text-lg leading-snug">
                Sample place. The photographs are repeated placeholders and do not show this location.
              </p>
              {undated.flatMap((section) => section.lines).map((line) => (
                <p key={line} className="text-muted-foreground">
                  {line}
                </p>
              ))}
              {post.area ? <p className="text-muted-foreground">Sample area: {post.area}</p> : null}
            </div>
          ) : (
            <>
              <div className={dated.length ? "mt-8 grid gap-10 md:mt-12 md:grid-cols-2 md:gap-8" : "hidden gap-8 md:mt-12 md:grid md:grid-cols-2"}>
                {photos.map((photo) => (
                  <section key={photo.label} className="min-w-0 space-y-4">
                    <Image
                      src={photo.src}
                      alt={`${post.name}, ${photo.year ?? photo.label}`}
                      width={post.w}
                      height={post.h}
                      sizes="50vw"
                      className="hidden w-full bg-muted md:block"
                    />
                    {photo.year ? (
                      <h2>
                        <button
                          type="button"
                          aria-label={`Show the whole ${photo.year} photograph`}
                          className="font-serif text-[3.25rem] leading-none underline-offset-[6px] hover:underline md:text-[4rem]"
                          onClick={() => showWholeFromWords(photo.target)}
                        >
                          {photo.year}
                        </button>
                      </h2>
                    ) : (
                      <p className="hidden text-muted-foreground md:block">{photo.label}</p>
                    )}
                    {photo.section ? <ChapterWords lines={photo.section.lines} /> : null}
                  </section>
                ))}
              </div>
              {undated.length && !dated.length ? (
                <div className="mt-8 max-w-2xl space-y-1 border-t pt-4">
                  {undated.flatMap((section) => section.lines).map((line) => (
                    <p key={line} className="text-lg">
                      {line}
                    </p>
                  ))}
                  <p className="text-muted-foreground">The dates and history of these photographs have not been written up yet.</p>
                </div>
              ) : null}
              <p className="mt-10 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t pt-4 text-[15px] text-muted-foreground">
                <span className="tabular-nums">{coordinates(post.location)}</span>
                <Link href={mapHref} className="-my-2 py-2 text-foreground underline underline-offset-4">
                  See it on the map
                </Link>
              </p>
            </>
          )}
        </article>
      </div>

      <section className="tn-story-edge border-t pb-16 pt-8 md:pb-24">
        {next ? (
          <h2 className="mb-5 font-serif text-4xl leading-none md:text-5xl">
            {post.sample ? "The real story behind these photographs" : "Next story"}
          </h2>
        ) : null}
        <div className="grid gap-10 md:grid-cols-[3fr_2fr] md:gap-8">
          {next ? (
            <div>
              <SeamTile
                href={`/${next.slug}`}
                name={next.name}
                thenSrc={next.b_imageUrl}
                nowSrc={next.a_imageUrl}
                ratio={next.w / next.h}
                trim={STORY_TRIM[next.slug]}
                sizes="(min-width: 768px) 60vw, 100vw"
              />
              <Link
                href={`/${next.slug}`}
                className="mt-2 block py-1 text-xl font-medium leading-snug underline-offset-4 hover:underline"
              >
                {next.name}
              </Link>
            </div>
          ) : null}
          <div>
            <h3 className="mb-3 text-[15px] text-muted-foreground">
              {post.sample ? "Nearby sample places" : "The other stories, nearest first"}
            </h3>
            <ul>
              {nearby.map((story) => (
                <li key={story.slug} className="border-b first:border-t">
                  <Link
                    href={`/${story.slug}`}
                    className="flex items-baseline justify-between gap-4 py-3 text-lg leading-snug underline-offset-4 hover:underline"
                  >
                    <span className="min-w-0">{story.name}</span>
                    <span className="shrink-0 text-[15px] tabular-nums text-muted-foreground">
                      {story.sample ? "Sample" : distanceLabel(story.km)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-x-6">
              <Link href="/places" className="inline-block py-2 underline underline-offset-4">
                All places
              </Link>
              <Link href={mapHref} className="inline-block py-2 underline underline-offset-4">
                Map
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
