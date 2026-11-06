'use client';

import React, { useCallback, useEffect, useState, forwardRef } from "react";
import PostType from "@/interfaces/post"
import { cn } from "@/lib/utils"
import { COMPARE_SIDE_GUTTER_PX } from "@/lib/compare";
import ImageSplit from "@/components/ImageSplit";
import { Slider } from "@/components/ui/slider";

interface PostProps extends React.HTMLAttributes<HTMLDivElement> {
  post: PostType;
}

const DEFAULT_POSITION = 50;

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

const Post = forwardRef<HTMLDivElement, PostProps>(({ post, className, ...props }, ref) => {
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [photoOnly, setPhotoOnly] = useState(false);

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

  useEffect(() => {
    if (!photoOnly) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPhotoOnly(false);
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [photoOnly]);

  const togglePhotoOnly = useCallback(() => {
    setPhotoOnly((current) => !current);
  }, []);

  return (
    <main
      ref={ref}
      className={cn(
        "flex-1 pt-14",
        // A container could trap the fixed photo view; viewport units take over.
        !photoOnly && "[container-type:inline-size]",
        className
      )}
      {...props}
    >
      <div
        className="tn-compare"
        data-focus={photoOnly}
        style={
          {
            "--compare-ratio": post.w / post.h,
            "--compare-min-gutter": `${COMPARE_SIDE_GUTTER_PX}px`,
          } as React.CSSProperties
        }
      >
        <div
          className={cn(
            photoOnly &&
              "fixed inset-0 z-40 flex items-center bg-black animate-in fade-in duration-200"
          )}
          onClick={(event) => {
            if (photoOnly && event.target === event.currentTarget) {
              setPhotoOnly(false);
            }
          }}
        >
          <ImageSplit
            post={post}
            position={position}
            onPositionChange={applyPosition}
            onTap={togglePhotoOnly}
            className={photoOnly ? "[touch-action:none]" : undefined}
          />
        </div>

        <div style={{ paddingInline: "var(--compare-gutter)" }}>
          <Slider
            aria-label="Compare slider"
            className="h-13 cursor-ew-resize"
            value={[position]}
            onValueChange={(value) => {
              applyPosition(value[0] ?? DEFAULT_POSITION);
            }}
          />
        </div>

        <div
          className="pb-12 pt-2"
          style={{
            paddingLeft: "max(1rem, calc((100cqw - var(--compare-frame-width)) / 2))",
            paddingRight: "max(1rem, calc((100cqw - var(--compare-frame-width)) / 2))",
          }}
        >
          <h1 className="max-w-3xl text-balance font-serif text-2xl leading-tight tracking-tight lg:text-3xl">
            {post.name}
          </h1>
          <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed text-foreground/75">
            {post.description}
          </p>
        </div>
      </div>
    </main>
  )
}) as React.ForwardRefExoticComponent<PostProps>

Post.displayName = "Post";

export default Post;
