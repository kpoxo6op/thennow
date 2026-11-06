"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"

import PostType, { type StorySummary } from "@/interfaces/post"
import { CompareStage } from "@/components/compare-stage"
import Desc, { toSections } from "@/components/Desc"
import { ResetScroll } from "@/components/reset-scroll"
import { StoryTile } from "@/components/story-tile"

interface PostProps {
  post: PostType
  nearby: StorySummary[]
}

const DEFAULT_POSITION = 50

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

export default function Post({ post, nearby }: PostProps) {
  const [position, setPosition] = useState(DEFAULT_POSITION)

  const applyPosition = useCallback((next: number) => {
    setPosition(clampPosition(next))
  }, [])

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
  const thenYear = sections[0]?.year
  const nowYear = sections.length > 1 ? sections[sections.length - 1]?.year : undefined
  const mapHref = `/places?view=map&lat=${post.location.lat}&lng=${post.location.lng}&z=15`

  return (
    <main
      className="tn-story tn-enter flex-1"
      style={{ "--ratio": post.w / post.h } as React.CSSProperties}
    >
      <ResetScroll />
      <div>
        <div className="tn-story-pin">
          <CompareStage
            name={post.name}
            thenSrc={post.b_imageUrl}
            nowSrc={post.a_imageUrl}
            ratio={post.w / post.h}
            position={position}
            onPositionChange={applyPosition}
            priority
            className="tn-story-stage"
          />
          <div className="tn-story-edge flex h-9 items-center justify-between font-serif text-sm italic text-muted-foreground">
            <span>then{thenYear ? ` ${thenYear}` : ""}</span>
            <span>now{nowYear ? ` ${nowYear}` : ""}</span>
          </div>
        </div>

        <article className="tn-story-edge space-y-6 pb-14 pt-3">
          <h1 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
            {post.name}
          </h1>
          <Desc description={post.description} />
          {post.sample ? (
            <p className="text-sm text-muted-foreground">
              Sample place. The photographs are repeated placeholders and do not
              show this location.
            </p>
          ) : null}
        </article>
      </div>

      <section className="tn-story-edge border-t py-8">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-2xl">Nearby</h2>
          <div className="flex gap-4 text-sm">
            <Link href={mapHref} className="-my-2 py-2 underline underline-offset-4">
              Map
            </Link>
            <Link href="/places" className="-my-2 py-2 underline underline-offset-4">
              All places
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-4">
          {nearby.map((story) => (
            <StoryTile
              key={story.slug}
              story={story}
              sizes="(min-width: 768px) 22vw, 50vw"
            />
          ))}
        </div>
      </section>
    </main>
  )
}
