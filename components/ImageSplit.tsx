"use client"

import React from "react"
import Image from "next/image"
import PostType from "@/interfaces/post"
import {
  ReactCompareSlider,
  ReactCompareSliderHandle,
  ReactCompareSliderImage,
} from "react-compare-slider"
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch"

import { cn } from "@/lib/utils"

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  post: PostType
  position: number
}

const ImageSplit = ({ post, position, className, ...props }: Props) => {
  return (
    <section
      className={cn("flex flex-1 flex-col items-center", className)}
      {...props}
    >
      <TransformWrapper
      centerOnInit={true}
      // initialScale={1}
      // minScale={1}
      >
        <TransformComponent
          wrapperClass=""
          contentClass=""
          wrapperStyle={{
            height: "100vh",
          }}
        >
          <ReactCompareSlider
            boundsPadding={0}
            style={{
              // border: "dashed",
              // height: "100vh",
              // width: "100%",
              // alignSelf: "center",
              // alignItems: "center",
              // justifyContent: "center",
              // display: "flex",
            }}
            position={position}
            onlyHandleDraggable={true}
            itemOne={
              <Image
                src={post.b_imageUrl}
                alt={post.name}
                width={post.w}
                height={post.h}
                style={
                  {
                    // objectFit: "contain",
                    // border: "4px solid #fff"
                  }
                }
              />
              // <ReactCompareSliderImage
              //   src={post.b_imageUrl}
              //   alt={post.name}
              //   style={{
              //     objectFit: "contain",
              //   }}
              // />
            }
            itemTwo={
              <Image
                src={post.a_imageUrl}
                alt={post.name}
                width={post.w}
                height={post.h}
                style={
                  {
                    // objectFit: "contain",
                    // border: "4px solid #fff"
                  }
                }
              />
              // <ReactCompareSliderImage
              //   src={post.a_imageUrl}
              //   alt={post.name}
              //   style={{
              //     objectFit: "contain",
              //   }}
              // />
            }
            handle={
              <ReactCompareSliderHandle
                buttonStyle={{ display: "none" }}
                linesStyle={{ display: "none" }}
              />
            }
          />
        </TransformComponent>
      </TransformWrapper>
    </section>
  )
}

export default ImageSplit
