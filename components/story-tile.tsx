import type { StorySummary } from "@/interfaces/post"
import { STORY_TRIM } from "@/lib/places"
import { SeamTile } from "@/components/seam-tile"

interface Props {
  story: StorySummary
  sizes: string
  priority?: boolean
  onPointerEnter?: React.PointerEventHandler<HTMLAnchorElement>
}

export function StoryTile({ story, sizes, priority, onPointerEnter }: Props) {
  return (
    <SeamTile
      href={`/${story.slug}`}
      name={story.name}
      thenSrc={story.b_imageUrl}
      nowSrc={story.a_imageUrl}
      ratio={3 / 2}
      trim={STORY_TRIM[story.slug]}
      sizes={sizes}
      priority={priority}
      prefetch={false}
      testId="story-card"
      onPointerEnter={onPointerEnter}
      caption={
        <span className="mt-2 block text-[15px] font-medium leading-snug underline-offset-4 group-hover:underline md:text-lg">
          {story.name}
        </span>
      }
    />
  )
}
