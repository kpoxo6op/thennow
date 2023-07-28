'use client';
import React from "react";
import { TransformWrapper, TransformComponent, useTransformEffect } from "react-zoom-pan-pinch";
import Image from 'next/image'
import { ReactCompareSlider, ReactCompareSliderHandle } from 'react-compare-slider';
import { cn } from "@/lib/utils"
import PostType from "@/interfaces/post"

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  post: PostType;
  position: number;
}

const ImageSplit = ({ post, position, className, ...props }: Props) => {

  // Define a new Component that will use the hook and render the children.
  // This is because the useTransformEffect hook must be used within the TransformComponent.
  const MyComponent = () => {
    useTransformEffect(({ state, instance }) => {
      console.log(state); // { previousScale: 1, scale: 1, positionX: 0, positionY: 0 }

      return () => {
        // unmount
      };
    });

    // We will render all the children of this component.
    // It's crucial for this component to be a direct child of the TransformComponent.
    return (
      <ReactCompareSlider
        boundsPadding={0}
        position={position}
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
    );
  }

  return (
    <section
      className={cn("flex flex-1 flex-col justify-center border-0 border-teal-600", className)}
      {...props}
    >
      <TransformWrapper
        centerZoomedOut
        centerOnInit
        initialScale={1}
        minScale={1}
      >
        <TransformComponent
          wrapperClass="border-0 border-green-600 grow"
          contentClass="border-0 border-orange-600"
        >
          {/* Insert the new component here */}
          <MyComponent />
        </TransformComponent>
      </TransformWrapper>
    </section>
  )
}

export default ImageSplit;
