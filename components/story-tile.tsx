import Image from "next/image"
import Link from "next/link"
import type { StorySummary } from "@/interfaces/post"

interface Props {
  story: StorySummary
  sizes: string
  priority?: boolean
  onPointerEnter?: React.PointerEventHandler<HTMLAnchorElement>
}

export function StoryTile({ story, sizes, priority, onPointerEnter }: Props) {
  return (
    <Link
      href={`/${story.slug}`}
      prefetch={false}
      data-testid="story-card"
      className="group block"
      onPointerEnter={onPointerEnter}
    >
      <Image
        src={story.ba_imageUrl}
        alt=""
        width={story.w}
        height={story.h}
        priority={priority}
        sizes={sizes}
        className="aspect-[3/2] w-full bg-muted object-cover transition-opacity duration-200 group-hover:opacity-85"
      />
      <span className="mt-1.5 line-clamp-2 block font-serif text-[15px] leading-snug underline-offset-4 group-hover:underline sm:text-base">
        {story.name}
      </span>
    </Link>
  )
}
