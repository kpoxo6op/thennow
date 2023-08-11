'use client';
import React, { useRef, useEffect } from "react";
import { TransformWrapper, TransformComponent, useTransformEffect } from "react-zoom-pan-pinch";
import { ReactCompareSlider, ReactCompareSliderHandle, ReactCompareSliderImage } from 'react-compare-slider';
import { cn } from "@/lib/utils";
import PostType from "@/interfaces/post";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  post: PostType;
  position: number;
}

const MyComponent = () => {
  const ref = useRef<HTMLDivElement | null>(null); // Reference to the element

  // Hook to track changes in the transform state
  useTransformEffect(({ state }) => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect(); // Get bounding client rect
      const hiddenLeft = Math.max(0, -rect.left); // Calculate hidden left part
      const hiddenRight = Math.max(0, rect.right - window.innerWidth); // Calculate hidden right part

      console.log({ hiddenLeft, hiddenRight }); // Log the results
    }

    return () => {
      // unmount
    };
  });

  // Return a div with a reference, so we can measure its dimensions
  return <div ref={ref} style={{ width: '100%', height: '100%' }}></div>;
};

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
      >
        <TransformComponent
          wrapperClass=""
          contentClass=""
        >
          <MyComponent /> {/* Include the MyComponent that uses useTransformEffect */}
          <ReactCompareSlider
            boundsPadding={0}
            style={{
              height: '100vh',
            }}
            position={position}
            onlyHandleDraggable={true}
            itemOne={
              <ReactCompareSliderImage
                src={post.b_imageUrl}
                alt={post.name}
                style={{
                  objectFit: 'contain',
                }}
              />
            }
            itemTwo={
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
  );
}

export default ImageSplit;
