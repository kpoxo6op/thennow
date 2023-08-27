'use client';

import React, { useState, forwardRef, useEffect } from "react";
import { Slider } from "@/components/ui/slider"
import PostType from "@/interfaces/post"
import { cn } from "@/lib/utils"
import ImageSplit from "@/components/ImageSplit";
import Desc from "@/components/Desc";



interface PostProps extends React.HTMLAttributes<HTMLDivElement> {
  post: PostType;
}

const Post = forwardRef<HTMLDivElement, PostProps>(({ post, className, ...props }, ref) => {
  const [value, setValue] = useState<number[]>([50]);
  const [showOverlay, setShowOverlay] = useState(false);
  const [mouseDownPosition, setMouseDownPosition] = useState<{ x: number; y: number } | null>(null);

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
          position={value[0]}
          className={showOverlay ? "z-30" : ""}
          onMouseDown={handleMouseDown} // Handle mouse down
          onMouseUp={handleImageSplitClick} // Handle mouse up
        />

        <Desc description={post.description} className="fixed inset-x-0 bottom-24 mx-auto flex max-w-prose whitespace-pre-line bg-background/50 px-2" />

        <div className="fixed inset-x-0 bottom-0 z-10 flex h-24 bg-background/50 px-10">
          <Slider
            defaultValue={[50]}
            onValueChange={setValue}>
          </Slider>
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
