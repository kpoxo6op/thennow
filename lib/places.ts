import type { StorySummary } from "@/interfaces/post"

export const STORIES_AREA = "stories"

export type PlaceGroup = {
  id: string
  title: string
  stories: StorySummary[]
}

export function groupByArea(stories: StorySummary[]): PlaceGroup[] {
  const groups = new Map<string, PlaceGroup>()

  stories.forEach((story) => {
    const id = story.area ?? STORIES_AREA
    const group = groups.get(id)

    if (group) {
      group.stories.push(story)
    } else {
      groups.set(id, { id, title: story.area ?? "Stories", stories: [story] })
    }
  })

  return Array.from(groups.values())
}

export function placesHref(params: { area?: string; view?: "map" }) {
  const search = new URLSearchParams(params)
  const query = search.toString()

  return query ? `/places?${query}` : "/places"
}
