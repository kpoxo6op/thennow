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

export type StoryLink = Pick<PostType, "name" | "slug" | "b_imageUrl" | "a_imageUrl" | "w" | "h" | "sample"> & {
  // Whether the story has any dated text yet, or only its photographs.
  written: boolean
}

interface PostProps {
  post: PostType
  next?: StoryLink
  nearby: (StoryLink & { km: number })[]
}

const DEFAULT_POSITION = 50
const ALL_THEN = 100
const ALL_NOW = 0
const GLIDE_MS = 520
// Past this a title wraps at desktop size, and the photograph gives it room in the first screen.
const LONG_TITLE = 56

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

// A source reads by its host. The full address is the link, and stays in the text for
// screen readers and copying.
function SourceLink({ source }: { source: string }) {
  const slash = source.indexOf("/")
  const host = slash === -1 ? source : source.slice(0, slash)
  const path = slash === -1 ? "" : source.slice(slash)

  return (
    <p className="text-[15px] leading-snug text-muted-foreground">
      Source:{" "}
      <a href={`https://${source}`} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">
        {host}
        <span className="text-[0px]">{path}</span>
      </a>
    </p>
  )
}

// The first sentence of a passage is its caption, and on a phone comes before its photograph.
function Chapter({ alt, src, w, h, year, lines }: { alt: string; src: string; w: number; h: number; year?: string; lines: string[] }) {
  const words = lines.filter((line) => !SOURCE_LINE.test(line))
  const sources = lines.filter((line) => SOURCE_LINE.test(line))
  const [lead, ...rest] = words

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="space-y-2 md:order-2">
        {year ? <h2 className="tn-reading text-[1.75rem] leading-none tabular-nums text-muted-foreground">{year}</h2> : null}
        {lead ? <p className="tn-reading text-xl leading-snug md:text-[1.375rem]">{lead}</p> : null}
      </div>
      <Image
        src={src}
        alt={alt}
        width={w}
        height={h}
        sizes="(min-width: 768px) 50vw, 100vw"
        className="aspect-[var(--ratio)] w-full bg-muted object-cover md:order-1"
      />
      {rest.length || sources.length ? (
        <div className="space-y-3 md:order-3 md:-mt-1">
          {rest.map((line) => (
            <p key={line} className="tn-reading text-lg leading-relaxed md:text-xl md:leading-relaxed">
              {line}
            </p>
          ))}
          {sources.map((source) => (
            <SourceLink key={source} source={source} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export default function Post({ post, next, nearby }: PostProps) {
  const [position, setPosition] = useState(DEFAULT_POSITION)
  const [lineHidden, setLineHidden] = useState(false)
  const glideRef = useRef<number | null>(null)
  // Where the line was before a whole photograph was asked for; asking again returns there.
  const returnRef = useRef(DEFAULT_POSITION)

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
  const mapHref = `/places?view=map&lat=${post.location.lat}&lng=${post.location.lng}&z=13&story=${post.slug}`
  const rounded = Math.round(position)
  const wholeShown = rounded === ALL_THEN || rounded === ALL_NOW

  const showWhole = (target: number) => {
    if (rounded === target) {
      glideTo(returnRef.current, position)
      return
    }

    if (rounded !== ALL_THEN && rounded !== ALL_NOW) {
      returnRef.current = position
    }

    glideTo(target, position)
  }

  const legendClass =
    "group -my-0.5 inline-flex h-11 shrink-0 items-center rounded-full"
  const legendPill =
    "inline-flex h-8 items-center gap-1.5 rounded-full border border-input px-3 text-sm transition-colors group-hover:border-foreground group-aria-pressed:border-foreground group-aria-pressed:bg-foreground group-aria-pressed:text-background"

  const photos = [
    { label: "then", year: thenYear, src: post.b_imageUrl, section: dated[0] },
    { label: "now", year: nowYear, src: post.a_imageUrl, section: dated.length > 1 ? dated[dated.length - 1] : undefined },
  ]

  return (
    <main
      className={`tn-story tn-enter flex-1${post.sample ? " tn-story--sample" : ""}${post.name.length > LONG_TITLE ? " tn-story--long-title" : ""}`}
      style={{ "--ratio": post.w / post.h } as React.CSSProperties}
    >
      <ResetScroll />
      <div>
        <div>
          <div className="relative">
            <CompareStage
              name={post.name}
              thenSrc={post.b_imageUrl}
              nowSrc={post.a_imageUrl}
              ratio={post.w / post.h}
              position={position}
              onPositionChange={applyPosition}
              onInteract={stopGlide}
              onLineStepsAside={setLineHidden}
              priority
              className="tn-story-stage"
            />
            {post.sample ? (
              <span className="tn-story-edge pointer-events-none absolute inset-x-0 top-3 flex">
                <span className="ml-1.5 whitespace-nowrap rounded-full bg-black/75 px-2.5 py-1 text-xs text-white sm:ml-2 sm:px-3 sm:text-sm">
                  Placeholder photographs
                </span>
              </span>
            ) : null}
          </div>
          <div className="tn-story-edge flex h-11 items-center justify-between">
            <button
              type="button"
              data-testid="story-show-then"
              aria-pressed={rounded === ALL_THEN}
              aria-label={`then${thenYear ? ` ${thenYear}` : ""}: ${rounded === ALL_THEN ? "return to the comparison" : "show this whole photograph"}`}
              className={legendClass}
              onClick={() => showWhole(ALL_THEN)}
            >
              <span className={legendPill}>
                then
                {thenYear ? <span className="tn-reading text-base leading-none tabular-nums">{thenYear}</span> : null}
              </span>
            </button>
            <p className="tn-hint-long hidden min-w-0 px-3 text-center text-sm text-muted-foreground">
              {wholeShown
                ? "Press the highlighted button, or drag the line, to compare"
                : "Drag the line, or choose then or now to see a whole photograph"}
            </p>
            <p className="tn-hint-short px-2 text-center text-sm text-muted-foreground">
              {lineHidden ? "Tap to compare" : "Drag the line"}
            </p>
            <button
              type="button"
              data-testid="story-show-now"
              aria-pressed={rounded === ALL_NOW}
              aria-label={`now${nowYear ? ` ${nowYear}` : ""}: ${rounded === ALL_NOW ? "return to the comparison" : "show this whole photograph"}`}
              className={legendClass}
              onClick={() => showWhole(ALL_NOW)}
            >
              <span className={legendPill}>
                now
                {nowYear ? <span className="tn-reading text-base leading-none tabular-nums">{nowYear}</span> : null}
              </span>
            </button>
          </div>
        </div>

        <article className="tn-story-edge pb-14 pt-3">
          <header className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <h1
              className={
                post.sample
                  ? "text-pretty font-serif text-[1.75rem] leading-[1.1] md:text-balance md:text-[clamp(2rem,4.5svh,2.5rem)]"
                  : "text-pretty font-serif text-[2.125rem] leading-[1.06] md:text-balance md:text-[clamp(2.25rem,5.8svh,3.25rem)]"
              }
            >
              {post.name}
            </h1>
            {yearsApart ? (
              <p className="tabular-nums text-muted-foreground">{yearsApart} years apart</p>
            ) : null}
          </header>

          {post.sample ? (
            <div className="mt-2 max-w-3xl space-y-1">
              <p className="text-[17px] leading-snug">
                Sample place. The photographs are repeated placeholders and do not show this location.
              </p>
              <p className="leading-snug text-muted-foreground">
                {undated.flatMap((section) => section.lines).join(" ")}
                {post.area ? ` Sample area: ${post.area}.` : ""}
              </p>
            </div>
          ) : (
            <>
              {dated.length ? (
                <div className="mt-8 grid gap-10 md:mt-14 md:grid-cols-2 md:gap-8">
                  {photos.map((photo) => (
                    <Chapter
                      key={photo.label}
                      alt={`${post.name}, ${photo.year ?? photo.label}`}
                      src={photo.src}
                      w={post.w}
                      h={post.h}
                      year={photo.year}
                      lines={photo.section?.lines ?? []}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-muted-foreground">
                  {undated.flatMap((section) => section.lines).join(" ")}
                </p>
              )}
              <p className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t pt-4 text-[15px] text-muted-foreground md:mt-10">
                <span className="tabular-nums">{coordinates(post.location)}</span>
                <Link href={mapHref} className="-my-2 py-2 text-foreground underline underline-offset-4">
                  See it on the map
                </Link>
              </p>
            </>
          )}
        </article>
      </div>

      <section className="tn-story-edge border-t pb-12 pt-8 md:pb-16">
        {next ? (
          <h2 className="mb-5 font-serif text-[2rem] leading-none md:text-[2.5rem]">
            {post.sample ? "Where these photographs come from" : "Next story"}
          </h2>
        ) : null}
        <div className="grid gap-10 md:grid-cols-2 md:gap-8">
          {next ? (
            <div>
              {post.sample ? null : (
                <SeamTile
                  href={`/${next.slug}`}
                  name={next.name}
                  thenSrc={next.b_imageUrl}
                  nowSrc={next.a_imageUrl}
                  ratio={16 / 9}
                  trim={STORY_TRIM[next.slug]}
                  sizes="(min-width: 768px) 50vw, 100vw"
                />
              )}
              <Link
                href={`/${next.slug}`}
                className={`block py-1 text-xl font-medium leading-snug underline underline-offset-4 ${post.sample ? "" : "mt-2 no-underline hover:underline"}`}
              >
                {next.name}
              </Link>
              {next.written ? null : <p className="text-[15px] text-muted-foreground">Text coming soon</p>}
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
                    className="flex items-baseline justify-between gap-4 py-3 text-lg leading-snug transition-colors hover:text-accent"
                  >
                    <span className="min-w-0">
                      {story.name}
                      {story.sample || story.written ? null : (
                        <span className="block text-[15px] text-muted-foreground">Text coming soon</span>
                      )}
                    </span>
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
              {post.sample ? (
                <Link href={mapHref} className="inline-block py-2 underline underline-offset-4">
                  Map
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
