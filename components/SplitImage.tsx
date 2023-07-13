'use client';

import Image from "next/image";
import { useState } from "react";

interface SplitImageProps {
  beforeImage: string;
  afterImage: string;
  split: number;
}

const SplitImage: React.FC<SplitImageProps> = ({ beforeImage,afterImage, split }) => {
  return (
    <div className="relative h-64">
      <Image
          src={afterImage}
          alt="After"
          fill
          style={{objectFit:"cover"}}
      />
      <div
        className="absolute h-full w-full overflow-hidden"
        style={{ clipPath: `inset(0 ${100-split}% 0 0)` }}
      >
        <Image
          src={beforeImage}
          alt="Before"
          fill
          style={{objectFit:"cover"}}
        />
      </div>
    </div>
  );
}

export default SplitImage;
