"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import PostType from "@/interfaces/post"
import { Maximize, X } from "lucide-react"

import { CompareStage } from "@/components/compare-stage"
import { PLACEHOLDER, SOURCE_LINE, toSections } from "@/components/Desc"
import { NearbyList, type Nearby } from "@/components/nearby-list"
import { ResetScroll } from "@/components/reset-scroll"
import { StoryMap } from "@/components/story-map"

interface PostProps {
  post: PostType
  nearby: Nearby[]
}

const DEFAULT_POSITION = 50
const ALL_THEN = 100
const ALL_NOW = 0
const GLIDE_MS = 520
// The address follows the line once it has rested this long. Safari refuses more than 100
// changes to the address in 30 seconds, and a drag would make hundreds.
const ADDRESS_REST_MS = 120
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

// A source reads by its host. The full address is the link, and stays in the text for
// screen readers and copying.
function SourceLink({ source }: { source: string }) {
  const slash = source.indexOf("/")
  const host = slash === -1 ? source : source.slice(0, slash)
  const path = slash === -1 ? "" : source.slice(slash)

  return (
    <p className="text-sm leading-snug text-muted-foreground">
      <a
        href={`https://${source}`}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4"
      >
        {host}
        <span className="text-[0px]">{path}</span>
      </a>
    </p>
  )
}

// What was written about one of the two photographs, under its year. The photograph
// itself is the comparison above: its year button shows it whole.
function Chapter({ year, lines }: { year?: string; lines: string[] }) {
  const words = lines.filter((line) => !SOURCE_LINE.test(line))
  const sources = lines.filter((line) => SOURCE_LINE.test(line))

  return (
    <section className="min-w-0 space-y-3">
      {year ? (
        <h2 className="text-sm tabular-nums text-muted-foreground">{year}</h2>
      ) : null}
      {words.map((line) => (
        <p key={line} className="text-lg leading-relaxed">
          {line}
        </p>
      ))}
      {sources.map((source) => (
        <SourceLink key={source} source={source} />
      ))}
    </section>
  )
}

// Words without a year, as written; the placeholder for none is left out.
function Words({ lines }: { lines: string[] }) {
  const words = lines.filter((line) => line !== PLACEHOLDER)
  if (!words.length) return null

  return (
    <div className="mt-4 max-w-3xl space-y-4">
      {words.map((line) => (
        <p key={line} className="text-lg leading-relaxed">
          {line}
        </p>
      ))}
    </div>
  )
}

export default function Post({ post, nearby }: PostProps) {
  const [position, setPosition] = useState(DEFAULT_POSITION)
  const [lineHidden, setLineHidden] = useState(false)
  // Once the line has been moved, the hint has done its job.
  const [touched, setTouched] = useState(false)
  const glideRef = useRef<number | null>(null)
  // Where the line was before a whole photograph was asked for; asking again returns there.
  const returnRef = useRef(DEFAULT_POSITION)
  // Zen: the same comparison and its years, alone on black and as large as the screen allows.
  const [zen, setZen] = useState(false)
  const zenRef = useRef<HTMLDivElement>(null)
  const zenButtonRef = useRef<HTMLButtonElement>(null)

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

  // Whether zen is wanted, read by a full screen request that settles late.
  const zenWantedRef = useRef(false)
  // Zen takes one step in history, so Back (Android's button, an iPhone's swipe) closes it
  // rather than leaving the place.
  const zenStepRef = useRef(false)
  const positionRef = useRef(position)
  useEffect(() => {
    positionRef.current = position
  }, [position])

  const enterZen = () => {
    zenWantedRef.current = true
    setZen(true)
    if (!zenStepRef.current) {
      try {
        window.history.pushState({ ...window.history.state, zen: true }, "")
        zenStepRef.current = true
      } catch {
        // Without the step, Back leaves the page as it always did.
      }
    }

    // Where the browser allows it the bars go too; an iPhone keeps the overlay alone.
    const block = zenRef.current
    if (block?.requestFullscreen) {
      block
        .requestFullscreen({ navigationUI: "hide" })
        .then(() => {
          // Closed while the screen was still changing.
          if (!zenWantedRef.current && document.fullscreenElement === block) {
            document.exitFullscreen().catch(() => {})
          }
        })
        .catch(() => {})
    }
  }

  const exitZen = useCallback(() => {
    // A second tap while the first is still closing does nothing.
    if (!zenWantedRef.current) return
    zenWantedRef.current = false
    if (document.fullscreenElement === zenRef.current) {
      document.exitFullscreen().catch(() => {})
    }
    if (zenStepRef.current) {
      // The step back closes zen (see onPopState).
      window.history.back()
      return
    }
    setZen(false)
  }, [])

  useEffect(() => {
    if (!zen) return

    const root = document.documentElement
    const block = zenRef.current
    const button = zenButtonRef.current
    const { overflow, overscrollBehavior } = root.style
    root.style.overflow = "hidden"
    root.style.overscrollBehavior = "none"
    // Focus starts on the close button, whatever opened zen.
    button?.focus({ preventScroll: true })

    // Everything else on the page is out of reach while zen is open, for screen readers too.
    const hidden: HTMLElement[] = []
    for (
      let node: HTMLElement | null = block;
      node && node !== document.body;
      node = node.parentElement
    ) {
      for (const sibling of Array.from(node.parentElement?.children ?? [])) {
        if (
          sibling !== node &&
          sibling instanceof HTMLElement &&
          !sibling.inert
        ) {
          sibling.inert = true
          hidden.push(sibling)
        }
      }
    }

    // The browser can leave its full screen itself (Esc on a desktop, Back on some phones).
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) exitZen()
    }

    // Zen's step was left: by Back, or by exitZen. Zen closes, the line stays where it was,
    // and the entry Back lands on is given the line's place.
    const onPopState = () => {
      if (!zenStepRef.current) return
      zenStepRef.current = false
      zenWantedRef.current = false
      if (document.fullscreenElement === block) {
        document.exitFullscreen().catch(() => {})
      }
      const kept = Math.round(positionRef.current)
      const url = new URL(window.location.href)
      if (kept === DEFAULT_POSITION) url.searchParams.delete("p")
      else url.searchParams.set("p", String(kept))
      try {
        window.history.replaceState(null, "", url)
      } catch {
        // The address is a convenience.
      }
      setZen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        exitZen()
        return
      }

      if (event.key !== "Tab" || !block) return

      // Focus stays with what zen shows.
      const focusable = Array.from(
        block.querySelectorAll<HTMLElement>("button, input")
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (!block.contains(active)) {
        event.preventDefault()
        first?.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener("fullscreenchange", onFullscreenChange)
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener("popstate", onPopState)

    return () => {
      root.style.overflow = overflow
      root.style.overscrollBehavior = overscrollBehavior
      for (const sibling of hidden) sibling.inert = false
      document.removeEventListener("fullscreenchange", onFullscreenChange)
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("popstate", onPopState)
      button?.focus({ preventScroll: true })
    }
  }, [zen, exitZen])

  useEffect(() => {
    const syncPositionFromUrl = () => {
      // Back out of zen's own step in history only closes zen (see onPopState).
      if (zenStepRef.current) return

      const url = new URL(window.location.href)
      const nextPosition = parsePositionParam(url.searchParams.get("p"))

      setPosition((currentPosition) => {
        if (Math.abs(currentPosition - nextPosition) < 0.01) {
          return currentPosition
        }

        return nextPosition
      })
    }

    // On arrival only an address that names a position moves the line. Without one the line is
    // already where it belongs, and a key or drag in the page's first instant must not be undone.
    if (new URL(window.location.href).searchParams.has("p")) {
      syncPositionFromUrl()
    }

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

    const resting = window.setTimeout(() => {
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
        try {
          window.history.replaceState(null, "", nextUrl)
        } catch {
          // The address is a convenience: a browser that refuses to change it must not stop the comparison.
        }
      }
    }, ADDRESS_REST_MS)

    // The line moved again, or the page is being left: that position is never written.
    return () => window.clearTimeout(resting)
  }, [position])

  const sections = toSections(post.description)
  const dated = sections.filter((section) => section.year)
  const undated = sections.filter((section) => !section.year)
  const thenYear = dated[0]?.year
  const nowYear = dated.length > 1 ? dated[dated.length - 1]?.year : undefined
  const rounded = Math.round(position)

  const showWhole = (target: number) => {
    setTouched(true)
    if (rounded === target) {
      glideTo(returnRef.current, position)
      return
    }

    if (rounded !== ALL_THEN && rounded !== ALL_NOW) {
      returnRef.current = position
    }

    glideTo(target, position)
  }

  const legendClass = "group -my-0.5 inline-flex h-11 shrink-0 items-center"
  const legendPill =
    "inline-flex h-8 items-center rounded-md border border-input px-3 tabular-nums transition-colors group-hover:border-foreground group-aria-pressed:border-foreground group-aria-pressed:bg-foreground group-aria-pressed:text-background"

  const photos = [
    { label: "then", year: thenYear, section: dated[0] },
    {
      label: "now",
      year: nowYear,
      section: dated.length > 1 ? dated[dated.length - 1] : undefined,
    },
  ]

  return (
    <main
      className={`tn-story tn-enter flex-1${post.sample ? " tn-story--sample" : ""}${post.name.length > LONG_TITLE ? " tn-story--long-title" : ""}`}
      style={{ "--ratio": post.w / post.h } as React.CSSProperties}
    >
      <ResetScroll />
      <div>
        <div
          ref={zenRef}
          data-zen={zen || undefined}
          role={zen ? "dialog" : undefined}
          aria-modal={zen || undefined}
          aria-label={zen ? post.name : undefined}
          className="tn-zen"
        >
          <div className="tn-zen-frame relative">
            <CompareStage
              name={post.name}
              thenSrc={post.b_imageUrl}
              nowSrc={post.a_imageUrl}
              ratio={post.w / post.h}
              position={position}
              onPositionChange={applyPosition}
              onInteract={() => {
                stopGlide()
                setTouched(true)
              }}
              onLineStepsAside={setLineHidden}
              priority
              className="tn-story-stage"
            />
            {post.sample && !zen ? (
              <span className="tn-story-edge pointer-events-none absolute inset-x-0 top-3 flex">
                <span className="ml-1.5 whitespace-nowrap rounded-full bg-black/75 px-2.5 py-1 text-xs text-white sm:ml-2 sm:px-3 sm:text-sm">
                  Placeholder photographs
                </span>
              </span>
            ) : null}
            <span className="tn-zen-toggle tn-story-edge pointer-events-none absolute inset-x-0 top-0 flex justify-end">
              <button
                ref={zenButtonRef}
                type="button"
                data-testid="story-zen"
                aria-label={zen ? "Close full screen" : "Full screen"}
                className="pointer-events-auto flex size-11 items-center justify-center text-white"
                onClick={zen ? exitZen : enterZen}
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-black/50">
                  {zen ? (
                    <X className="size-[18px]" />
                  ) : (
                    <Maximize className="size-[18px]" />
                  )}
                </span>
              </button>
            </span>
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
              <span className={legendPill}>{thenYear ?? "then"}</span>
            </button>
            {/* One hint until the line is first moved; after that only when there is no line to see. */}
            <p className="px-2 text-center text-sm text-muted-foreground">
              {zen
                ? null
                : lineHidden
                  ? "Tap to compare"
                  : touched
                    ? null
                    : "Drag the line"}
            </p>
            <button
              type="button"
              data-testid="story-show-now"
              aria-pressed={rounded === ALL_NOW}
              aria-label={`now${nowYear ? ` ${nowYear}` : ""}: ${rounded === ALL_NOW ? "return to the comparison" : "show this whole photograph"}`}
              className={legendClass}
              onClick={() => showWhole(ALL_NOW)}
            >
              <span className={legendPill}>{nowYear ?? "now"}</span>
            </button>
          </div>
        </div>

        <article className="tn-story-edge pb-14 pt-3">
          <h1
            className={
              "text-pretty font-serif text-[2.125rem] leading-[1.06] md:text-balance md:text-[clamp(2.25rem,5.8svh,3.25rem)]"
            }
          >
            {post.name}
          </h1>

          {post.sample ? (
            <div className="mt-2 max-w-3xl space-y-1">
              <p className="text-[17px] leading-snug">
                Sample place. The photographs are repeated placeholders and do
                not show this location.
              </p>
              <p className="leading-snug text-muted-foreground">
                {undated.flatMap((section) => section.lines).join(" ")}
                {post.area ? ` Sample area: ${post.area}.` : ""}
              </p>
            </div>
          ) : (
            <>
              {dated.length ? (
                <div className="mt-6 grid max-w-3xl gap-8">
                  {photos.map((photo) => (
                    <Chapter
                      key={photo.label}
                      year={photo.year}
                      lines={photo.section?.lines ?? []}
                    />
                  ))}
                </div>
              ) : (
                <Words lines={undated.flatMap((section) => section.lines)} />
              )}
              <StoryMap name={post.name} location={post.location} />
            </>
          )}
        </article>
      </div>

      <section className="tn-story-edge pb-12 md:pb-16">
        <NearbyList items={nearby} />
      </section>
    </main>
  )
}
