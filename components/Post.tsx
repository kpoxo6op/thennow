'use client';

import React, { useCallback, useEffect, useState, forwardRef } from "react";
import PostType from "@/interfaces/post"
import { cn } from "@/lib/utils"
import { COMPARE_SIDE_GUTTER_PX } from "@/lib/compare";
import ImageSplit from "@/components/ImageSplit";
import Desc from "@/components/Desc";
import { ResetScroll } from "@/components/reset-scroll";
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
  const [showOverlay, setShowOverlay] = useState(false);

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
    if (!showOverlay) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowOverlay(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showOverlay]);

  return (
    <main
      ref={ref}
      data-immersive={showOverlay}
      className={cn("tn-story tn-enter flex-1", className)}
      style={
        {
          "--ratio": post.w / post.h,
          "--compare-gutter": `${COMPARE_SIDE_GUTTER_PX}px`,
        } as React.CSSProperties
      }
      {...props}
    >
      <ResetScroll />
      <div className="tn-story-pin">
        <ImageSplit
          post={post}
          position={position}
          immersive={showOverlay}
          onPositionChange={applyPosition}
          onTap={() => setShowOverlay((current) => !current)}
        />

        <div className="tn-story-slider flex">
          <Slider
            aria-label="Compare slider"
            className="cursor-ew-resize"
            value={[position]}
            onValueChange={(value) => {
              applyPosition(value[0] ?? DEFAULT_POSITION);
            }}
          />
        </div>
      </div>

      <article className="tn-story-text space-y-6 pb-16 pt-2">
        <h1 className="font-serif text-2xl leading-tight tracking-tight sm:text-3xl">
          {post.name}
        </h1>
        <Desc description={post.description} />
      </article>
    </main>
  )
}) as React.ForwardRefExoticComponent<PostProps>

Post.displayName = "Post";

export default Post;
