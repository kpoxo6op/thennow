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

  const handleImageSplitClick = () => {
    setShowOverlay(!showOverlay);
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
          onClick={handleImageSplitClick}
        />

        <Desc description={post.description} className="fixed inset-x-0 bottom-24 flex whitespace-pre-line bg-background/50 px-2" />

        <div className="fixed inset-x-0 bottom-0 flex h-24 bg-background/50 px-10">
          <Slider
            min={0}
            max={100}
            step={1}
            defaultValue={[50]}
            onValueChange={setValue}
            className="z-10">
          </Slider>
        </div>

        {showOverlay && (
          <div
            className="absolute inset-0 z-20 bg-background animate-in fade-in"
            onClick={handleImageSplitClick}
          />
        )}
      </section>
    </>
  )
}) as React.ForwardRefExoticComponent<PostProps>

Post.displayName = "Post";

export default Post;
