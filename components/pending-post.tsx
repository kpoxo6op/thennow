import Image from "next/image"
import Link from "next/link"
import { Camera } from "lucide-react"

import type { PendingPost as PendingPostType } from "@/interfaces/post"
import { ResetScroll } from "@/components/reset-scroll"
import { StoryMap } from "@/components/story-map"

type Onward = { name: string; slug: string; km: number }

interface Props {
  post: PendingPostType
  stories: Onward[]
  pending: Onward[]
}

function distanceLabel(km: number) {
  return km < 1 ? "Under 1 km away" : `${Math.round(km)} km away`
}

function OnwardList({ title, items }: { title: string; items: Onward[] }) {
  return (
    <div>
      <h3 className="mb-3 text-[15px] text-muted-foreground">{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.slug} className="border-b first:border-t">
            <Link
              href={`/${item.slug}`}
              className="flex items-baseline justify-between gap-4 py-3 text-lg leading-snug transition-colors hover:text-accent"
            >
              <span className="min-w-0">{item.name}</span>
              <span className="shrink-0 text-[15px] tabular-nums text-muted-foreground">{distanceLabel(item.km)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// The archive photograph, what it shows and where it is. No comparison exists to offer yet.
export function PendingPost({ post, stories, pending }: Props) {
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
      <div className="tn-story-edge flex min-h-11 flex-wrap items-center gap-x-5 py-1">
        <p className="inline-flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">then</span>
          <span className="tn-reading text-base leading-none">{archive.date}</span>
        </p>
        <p data-testid="pending-status" className="inline-flex items-center gap-2 text-sm font-medium">
          <span aria-hidden className="size-2.5 rounded-full border-2 border-foreground" />
          Upcoming: modern photograph to come
        </p>
        <Link
          href={`/${post.slug}/camera`}
          data-testid="pending-camera"
          className="inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4 transition-colors hover:text-accent"
        >
          <Camera className="size-4" aria-hidden />
          Take it now
        </Link>
      </div>

      <article className="tn-story-edge pb-14 pt-3">
        <h1 className="text-pretty font-serif text-[2.125rem] leading-[1.06] md:text-balance md:text-[clamp(2.25rem,5.8svh,3.25rem)]">
          {post.name}
        </h1>
        <div className="mt-6 max-w-2xl space-y-4">
          <p className="tn-reading text-xl leading-snug md:text-[1.375rem]">{post.description}</p>
          <p className="text-[15px] leading-snug text-muted-foreground">
            {archive.photographer === "Unknown" ? "Photographer unknown" : `Photograph: ${archive.photographer}`}.{" "}
            {archive.credit}. {archive.rights}.{" "}
            <a
              href={archive.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="whitespace-nowrap text-foreground underline underline-offset-4"
            >
              View the record
            </a>
          </p>
        </div>
        <StoryMap name={post.name} location={post.location} />
        <p className="mt-2 text-[15px] text-muted-foreground">The pin marks the place, not where the photograph was taken.</p>
      </article>

      <section className="tn-story-edge border-t pb-12 pt-8 md:pb-16">
        <div className="grid gap-10 md:grid-cols-2 md:gap-8">
          <OnwardList title="Stories to compare, nearest first" items={stories} />
          <div>
            <OnwardList title="Also upcoming" items={pending} />
            <div className="mt-4 flex flex-wrap gap-x-6">
              <Link href="/places" className="inline-block py-2 underline underline-offset-4">
                All places
              </Link>
              <Link
                href={`/places?view=map&lat=${post.location.lat}&lng=${post.location.lng}&z=13&story=${post.slug}`}
                className="inline-block py-2 underline underline-offset-4"
              >
                Map
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
