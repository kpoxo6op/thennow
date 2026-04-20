'use client';

import React, { useCallback, useEffect, useState, forwardRef } from "react";
import PostType from "@/interfaces/post"
import { cn } from "@/lib/utils"
import { COMPARE_SIDE_GUTTER_PX } from "@/lib/compare";
import ImageSplit from "@/components/ImageSplit";
import Desc from "@/components/Desc";
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
  const [mouseDownPosition, setMouseDownPosition] = useState<{ x: number; y: number } | null>(null);

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

  // Function to handle mouse down event
  const handleMouseDown = (event: React.MouseEvent) => {
    setMouseDownPosition({ x: event.clientX, y: event.clientY });
  }

  // Function to handle mouse up event
  const handleImageSplitClick = (event: React.MouseEvent) => {
    // Get the mouse up position
    const mouseUpPosition = { x: event.clientX, y: event.clientY };

    // Check if mouse down position is set and if there was a significant movement
    if (mouseDownPosition &&
        Math.abs(mouseDownPosition.x - mouseUpPosition.x) < 5 &&
        Math.abs(mouseDownPosition.y - mouseUpPosition.y) < 5) {
      // If no significant movement, consider it a click and toggle the overlay
      setShowOverlay(!showOverlay);
    }

    // Reset the mouse down position
    setMouseDownPosition(null);
  }

  return (
    <>
      <section
        ref={ref}
        className={cn(
          "max-w-screen flex max-h-screen flex-1 flex-col",
          className
        )}
        {...props}
      >
        <ImageSplit
          post={post}
          position={position}
          onPositionChange={applyPosition}
          className={showOverlay ? "z-30" : ""}
          onMouseDown={handleMouseDown} // Handle mouse down
          onMouseUp={handleImageSplitClick} // Handle mouse up
        />

        <Desc description={post.description} className="fixed inset-x-0 bottom-24 mx-auto flex max-w-prose whitespace-pre-line bg-background/50 px-2" />

        <div
          className="fixed inset-x-0 bottom-0 z-10 flex h-24 bg-background/50"
          style={{ paddingInline: `${COMPARE_SIDE_GUTTER_PX}px` }}
        >
          <Slider
            aria-label="Compare slider"
            className="cursor-ew-resize"
            value={[position]}
            onValueChange={(value) => {
              applyPosition(value[0] ?? DEFAULT_POSITION);
            }}
          />
        </div>

        {showOverlay && (
          <div
            className="absolute inset-0 z-20 h-screen bg-background animate-in fade-in"
            onClick={handleImageSplitClick}
          />
        )}
      </section>
    </>
  )
}) as React.ForwardRefExoticComponent<PostProps>

Post.displayName = "Post";

export default Post;
