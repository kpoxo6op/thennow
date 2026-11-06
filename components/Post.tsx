'use client';

import React, { useCallback, useEffect, useState, forwardRef } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";

import PostType from "@/interfaces/post"
import { cn } from "@/lib/utils"
import { CompareFrame } from "@/components/compare-frame";
import { PlaceRow, type PlaceSummary } from "@/components/place-row";

interface PostProps extends React.HTMLAttributes<HTMLDivElement> {
  post: PostType;
  previous: PlaceSummary;
  next: PlaceSummary;
  nearby: PlaceSummary[];
  imageSource?: PlaceSummary;
}

const DEFAULT_POSITION = 50;
const IMAGE_SIZES = "(min-width: 1024px) 75vw, 100vw";
const MAP_ZOOM = 15;

function clampPosition(position: number) {
  return Math.min(100, Math.max(0, position));
}

function parsePositionParam(positionParam: string | null) {
  if (!positionParam) {
    return DEFAULT_POSITION;
  }

  const parsedPosition = Number(positionParam);

  if (!Number.isFinite(parsedPosition)) {
    return DEFAULT_POSITION;
  }

  return clampPosition(parsedPosition);
}

// Source addresses are written bare in the captions; the text stays as written.
function linkSources(description: string) {
  return description.split(/(\b[\w-]+(?:\.[\w-]+)*\.(?:nz|com|org|net)\b(?:\/\S*)?)/).map((part, index) =>
    index % 2 === 1 ? (
      <a key={index} href={`https://${part}`} className="underline underline-offset-2 hover:text-foreground">
        {part}
      </a>
    ) : (
      part
    )
  );
}

const Post = forwardRef<HTMLDivElement, PostProps>(({ post, previous, next, nearby, imageSource, className, ...props }, ref) => {
  const [position, setPosition] = useState(DEFAULT_POSITION);

  const applyPosition = useCallback((position: number) => {
    setPosition(clampPosition(position));
  }, []);

  useEffect(() => {
    const syncPositionFromUrl = () => {
      const url = new URL(window.location.href);
      const nextPosition = parsePositionParam(url.searchParams.get("p"));

      setPosition((currentPosition) => {
        if (Math.abs(currentPosition - nextPosition) < 0.01) {
          return currentPosition;
        }

        return nextPosition;
      });
    };

    syncPositionFromUrl();
    window.addEventListener("popstate", syncPositionFromUrl);

    return () => {
      window.removeEventListener("popstate", syncPositionFromUrl);
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const roundedPosition = Math.round(position);

    if (roundedPosition === DEFAULT_POSITION) {
      url.searchParams.delete("p");
    } else {
      url.searchParams.set("p", String(roundedPosition));
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [position]);

  const mapHref = `/?lat=${post.location.lat}&lng=${post.location.lng}&z=${MAP_ZOOM}&view=map&spot=${post.slug}`;

  return (
    <main
      ref={ref}
      className={cn("tn-story flex-1 pt-14", className)}
      {...props}
    >
      <CompareFrame
        post={post}
        position={position}
        onPositionChange={applyPosition}
        sizes={IMAGE_SIZES}
        className="tn-story-photo"
      />

      <aside className="tn-story-text px-4 pb-10 pt-5 [overflow-wrap:anywhere]">
        <h1 className="text-balance font-serif text-[1.75rem] leading-tight tracking-tight">
          {post.name}
        </h1>
        <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed text-foreground/80 lg:text-[0.9375rem]">
          {linkSources(post.description)}
        </p>

        {post.isSample && (
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground" data-testid="sample-note">
            Sample place. The name and location are fictional.
            {imageSource && (
              <>
                {" "}The photographs belong to{" "}
                <Link href={`/${imageSource.slug}`} className="underline underline-offset-2 hover:text-foreground">
                  {imageSource.name}
                </Link>
                .
              </>
            )}
          </p>
        )}

        <Link
          href={mapHref}
          className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-sm text-sm font-medium"
        >
          <MapPin aria-hidden className="size-4" />
          On the map
        </Link>

        <section aria-labelledby="nearby-title" className="mt-6 border-t border-border/70 pt-4">
          <h2 id="nearby-title" className="text-sm font-medium text-muted-foreground">
            Nearby
          </h2>
          <ul className="-mx-2 mt-1">
            {nearby.map((place) => (
              <li key={place.slug}>
                <PlaceRow place={place} />
              </li>
            ))}
          </ul>
        </section>

        <nav aria-label="More stories" className="mt-4 grid grid-cols-2 gap-3 border-t border-border/70 pt-3 text-sm">
          <Link href={`/${previous.slug}`} rel="prev" data-testid="story-previous" className="flex min-h-11 items-start gap-1.5 rounded-sm py-1.5 hover:underline hover:underline-offset-2">
            <ArrowLeft aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span className="line-clamp-2">{previous.name}</span>
          </Link>
          <Link href={`/${next.slug}`} rel="next" data-testid="story-next" className="flex min-h-11 items-start justify-end gap-1.5 rounded-sm py-1.5 text-right hover:underline hover:underline-offset-2">
            <span className="line-clamp-2">{next.name}</span>
            <ArrowRight aria-hidden className="mt-0.5 size-4 shrink-0" />
          </Link>
        </nav>
      </aside>
    </main>
  )
}) as React.ForwardRefExoticComponent<PostProps>

Post.displayName = "Post";

export default Post;
