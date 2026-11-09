import Image from "next/image"
import type { PendingPost as PendingPostType } from "@/interfaces/post"
import { Camera } from "lucide-react"

import { NearbyList, type Nearby } from "@/components/nearby-list"
import { CameraLink } from "@/components/rephoto/camera-link"
import { ResetScroll } from "@/components/reset-scroll"
import { StoryMap } from "@/components/story-map"

interface Props {
  post: PendingPostType
  nearby: Nearby[]
}

// The archive photograph, what it shows and where it is. The button says the rest.
export function PendingPost({ post, nearby }: Props) {
  const { archive } = post

  return (
    <main
      className="tn-story tn-story--pending tn-enter flex-1"
      style={{ "--ratio": post.w / post.h } as React.CSSProperties}
    >
      <ResetScroll />
      <figure className="tn-story-stage relative">
        <div className="tn-compare-image">
          <Image
            src={post.b_imageUrl}
            alt={`${post.name}, ${archive.date}`}
            data-testid="pending-photograph"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
      </figure>
      <div className="tn-story-edge flex min-h-11 items-center justify-between gap-4 py-1">
        <p data-testid="pending-date" className="text-muted-foreground">
          {archive.date}
        </p>
        <CameraLink
          href={`/${post.slug}/camera`}
          landscape={post.w > post.h}
          data-testid="pending-camera"
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-foreground px-5 font-medium text-background transition-opacity hover:opacity-85"
        >
          <Camera className="size-4" aria-hidden />
          Take it now
        </CameraLink>
      </div>

      <article className="tn-story-edge pb-14 pt-3">
        <h1 className="text-pretty font-serif text-[2.125rem] leading-[1.06] md:text-balance md:text-[clamp(2.25rem,5.8svh,3.25rem)]">
          {post.name}
        </h1>
        <div className="mt-4 max-w-3xl space-y-4">
          <p className="text-lg leading-relaxed">{post.description}</p>
          <p className="text-sm leading-snug text-muted-foreground">
            {archive.photographer === "Unknown"
              ? "Photographer unknown"
              : `Photograph: ${archive.photographer}`}
            . {archive.credit}. {archive.rights}.{" "}
            <a
              href={archive.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="whitespace-nowrap underline underline-offset-4"
            >
              View the record
            </a>
          </p>
        </div>
        <StoryMap name={post.name} location={post.location} />
      </article>

      <section className="tn-story-edge pb-12 md:pb-16">
        <NearbyList items={nearby} />
      </section>
    </main>
  )
}
