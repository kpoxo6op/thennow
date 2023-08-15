'use client';
import React from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import Image from 'next/image'
import { ReactCompareSlider, ReactCompareSliderHandle, ReactCompareSliderImage } from 'react-compare-slider';
import { cn } from "@/lib/utils"
import PostType from "@/interfaces/post"

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  post: PostType;
  position: number;
}

const ImageSplit = ({ post, position, className, ...props }: Props) => {

  return (
    <section
      className={cn("flex flex-1 flex-col items-center", className)}
      {...props}
    >
      <TransformWrapper
        centerOnInit
        centerZoomedOut
        initialScale={1}
        minScale={1}
        limitToBounds
      >
        <TransformComponent
          wrapperClass=""
          contentClass=""
        >
          <ReactCompareSlider
            boundsPadding={0}
            style={{
              height: '100vh',
              // width: '100%',
              // objectPosition: 'center',
            }}
            position={position}
            onlyHandleDraggable={true}
            itemOne={
              // <Image
              //   src={post.b_imageUrl}
              //   alt={post.name}
              //   width={post.w}
              //   height={post.h}
              //   style={{
              //     objectFit: "contain",
              //     border: "4px solid #fff"
              //   }}
              // />
              <ReactCompareSliderImage
                src={post.b_imageUrl}
                alt={post.name}
                style={{
                  objectFit: 'contain',
                }}
              />
            }
            itemTwo={
              // <Image
              //   src={post.a_imageUrl}
              //   alt={post.name}
              //   width={post.w}
              //   height={post.h}
              //   style={{
              //     objectFit: "contain",
              //     border: "4px solid #fff"
              //   }}
              // />
              <ReactCompareSliderImage
                src={post.a_imageUrl}
                alt={post.name}
                style={{
                  objectFit: 'contain',
                }}
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
    </section>
  )
}

export default ImageSplit;
