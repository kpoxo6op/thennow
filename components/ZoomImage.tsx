'use client';

import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import Image from 'next/image'
import React from 'react';

type ZoomImageProps = {
  src: string,
  alt: string,
};

export const ZoomImage: React.FC<ZoomImageProps> = ({ src, alt }) => {
  return (
    <TransformWrapper minScale={1}>
      <TransformComponent>
          <Image
            src={src}
            alt={alt}
            width="0"
            height="0"
            sizes="(max-width: 768px) 100vw"
            className="h-auto w-screen"
          />
      </TransformComponent>
    </TransformWrapper>
  );
};
