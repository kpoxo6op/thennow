import type { Place } from "@/interfaces/post"

// The fountain's negative has a heavy black border and notched corners.
export const STORY_TRIM: Record<string, number> = { "mission-bay-fountain": 1.16 }

export type PlaceGroup = {
  id: string
  title: string
  stories: Place[]
}

// A story's area is the town its own name ends with: "Mill House, Auckland".
export function storyArea(story: Pick<Place, "name" | "area">) {
  return story.area ?? story.name.split(",").pop()?.trim() ?? story.name
}

export function groupByArea(stories: Place[]): PlaceGroup[] {
  const groups = new Map<string, PlaceGroup>()

  stories.forEach((story) => {
    const id = storyArea(story)
    const group = groups.get(id)

    if (group) {
      group.stories.push(story)
    } else {
      groups.set(id, { id, title: id, stories: [story] })
    }
  })

  return Array.from(groups.values())
}

export function placesHref(params: { area?: string; view?: "map" }) {
  const search = new URLSearchParams(params)
  const query = search.toString()

  return query ? `/places?${query}` : "/places"
}
