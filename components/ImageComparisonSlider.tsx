'use client';

import React, { useState, forwardRef } from "react";
import { Slider } from "@/components/ui/slider"
import Post from "@/interfaces/post"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import Image from 'next/image'
import { ReactCompareSlider, ReactCompareSliderHandle } from 'react-compare-slider';


interface ImageComparisonSliderProps extends React.HTMLAttributes<HTMLDivElement> {
  post: Post;
}

const ImageComparisonSlider = forwardRef<HTMLDivElement, ImageComparisonSliderProps>(({ post, className, ...props }, ref) => {
  const [value, setValue] = useState<number[]>([50]);

  return (
    <section className="fixed inset-0 flex h-screen w-screen items-center justify-center bg-background">
      <TransformWrapper centerOnInit>
        <TransformComponent
          wrapperStyle={{
            width: "100%",
            height: "100%",
          }}
        >
          <ReactCompareSlider
            position={value[0]}
            onlyHandleDraggable={true}
            itemOne={
              <Image
                src={post.b_imageUrl}
                alt={post.name}
                width={post.w}
                height={post.h}
              />
            }
            itemTwo={
              <Image
                src={post.a_imageUrl}
                alt={post.name}
                width={post.w}
                height={post.h}
              />
            }
            handle={
              <ReactCompareSliderHandle
                buttonStyle={{ display: 'none' }}
                linesStyle={{ display: 'none' }}
              />
            }
          />
        </TransformComponent>
      </TransformWrapper>
      <div className="fixed inset-x-0 bottom-4 mx-12">
        <Slider
          defaultValue={[50]}
          onValueChange={setValue}
          className="py-12"
        />
      </div>
    </section>
  )
}) as React.ForwardRefExoticComponent<ImageComparisonSliderProps>

ImageComparisonSlider.displayName = "ImageComparisonSlider";

export default ImageComparisonSlider;
