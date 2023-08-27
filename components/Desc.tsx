// Desc.tsx
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils"


interface DescProps {
  description: string;
  className?: string;
}

const Desc: React.FC<DescProps> = ({ description, className }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mouseDown, setMouseDown] = useState(false);

  const descriptionClassnames = isExpanded ? 'line-clamp-30 overflow-auto' : 'line-clamp-2';

  const handleMouseDown = () => setMouseDown(true);

  const handleMouseUp = () => {
    setMouseDown(false);
    if (window.getSelection()?.toString() === '') {
      setIsExpanded(!isExpanded);
    }
  }

  useEffect(() => {
    document.addEventListener('selectionchange', () => {
      if (mouseDown && window.getSelection()?.toString() !== '') {
        setMouseDown(false);
      }
    });
    return () => {
      document.removeEventListener('selectionchange', () => {});
    };
  }, [mouseDown]);

  return (
    <div
      className={cn(
        "",
        className  // added className prop here
      )}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <p className={`${descriptionClassnames}`}>
        {description}
      </p>
    </div>
  )
}

export default Desc;
