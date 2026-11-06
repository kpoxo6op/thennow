const STORY_ORIGIN_KEY = "thennow:story-origin"
const LIST_SCROLL_STATE = "thennowListScroll"

// Marks that a story was opened from the collection, so leaving it can return
// to the same list position and map view instead of a fresh homepage.
export function rememberStoryOrigin(slug: string) {
  window.sessionStorage.setItem(STORY_ORIGIN_KEY, slug)
  // Kept on this history entry, so only a return to it restores the position.
  window.history.replaceState(
    { ...window.history.state, [LIST_SCROLL_STATE]: window.scrollY },
    ""
  )
}

export function restoreListScroll() {
  const state = window.history.state
  const scrollY = state?.[LIST_SCROLL_STATE]

  window.sessionStorage.removeItem(STORY_ORIGIN_KEY)

  if (typeof scrollY !== "number") {
    return
  }

  window.scrollTo(0, scrollY)

  const { [LIST_SCROLL_STATE]: _restored, ...rest } = state
  window.history.replaceState(rest, "")
}

export function consumeStoryOrigin(slug: string) {
  const isOrigin = window.sessionStorage.getItem(STORY_ORIGIN_KEY) === slug

  if (isOrigin) {
    window.sessionStorage.removeItem(STORY_ORIGIN_KEY)
  }

  return isOrigin
}

export const SHOW_ALL_STORIES_EVENT = "thennow:show-all-stories"
