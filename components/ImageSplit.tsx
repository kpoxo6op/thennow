import React from 'react';
import Image from "next/image";
import Post from '@/interfaces/post';

interface ImageSplitProps {
  images: Post;
  split: number[];
}

const ImageSplit: React.FC<ImageSplitProps> = ({ images, split }) => {
  const aspectRatio = images.h / images.w * 100;

  return (
    <div className="relative w-full max-w-lg">
      <div
        style={{ paddingBottom: `${aspectRatio}%` }}
        className="relative h-0 w-full"
      >
        <Image
          src={images.a_imageUrl}
          alt={images.name}
          // fill
          className="absolute left-0 top-0 h-full w-full"
          style={{ objectFit: "cover" }}
          width={images.w}
          height={images.h}
        />
        <div
          className="absolute h-full w-full overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - split[0]}% 0 0)` }}
        >
          <Image
            src={images.b_imageUrl}
            alt={images.name}
            // fill
            className="absolute left-0 top-0 h-full w-full"
            style={{ objectFit: "cover" }}
            width={images.w}
            height={images.h}
          />
        </div>
      </div>
    </div>
  )
}

export default ImageSplit;
