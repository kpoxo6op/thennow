const STORY_ORIGIN_KEY = "thennow:story-origin"
const LIST_RETURN_STATE = "thennowListReturn"

export const SHOW_ALL_STORIES_EVENT = "thennow:show-all-stories"

type ListState = {
  openGroups: string[]
  visibleSlugs: string[] | null
}

type ListReturn = ListState & {
  scrollY: number
}

let listStateAtLeave: () => ListState = () => ({
  openGroups: [],
  visibleSlugs: null,
})
let isLeavingList = false
let isFirstListMount = true

export function trackListState(read: () => ListState) {
  listStateAtLeave = read
}

// Kept on the history entry being left, so only a return to it restores.
export function rememberListState() {
  const listReturn: ListReturn = {
    ...listStateAtLeave(),
    scrollY: window.scrollY,
  }
  window.history.replaceState(
    { ...window.history.state, [LIST_RETURN_STATE]: listReturn },
    ""
  )
  isLeavingList = true
}

// Marks that a story was opened from the collection, so its wordmark can go
// back to the same list position and map view instead of a fresh homepage.
export function rememberStoryOrigin(slug: string) {
  window.sessionStorage.setItem(STORY_ORIGIN_KEY, slug)
  rememberListState()
}

export function takeListReturn(): ListReturn | null {
  const wasFirstMount = isFirstListMount
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined

  isFirstListMount = false
  isLeavingList = false
  window.sessionStorage.removeItem(STORY_ORIGIN_KEY)

  if (wasFirstMount && navigation?.type === "reload") {
    return null
  }

  return window.history.state?.[LIST_RETURN_STATE] ?? null
}

export function consumeStoryOrigin(slug: string) {
  const isOrigin = window.sessionStorage.getItem(STORY_ORIGIN_KEY) === slug

  if (isOrigin) {
    window.sessionStorage.removeItem(STORY_ORIGIN_KEY)
  }

  return isOrigin
}

// Moving on to another story means the list is no longer directly behind.
export function forgetStoryOriginUnless(slug: string) {
  if (window.sessionStorage.getItem(STORY_ORIGIN_KEY) !== slug) {
    window.sessionStorage.removeItem(STORY_ORIGIN_KEY)
  }
}

// Next treats a URL write as a restore, which would cancel a pending
// navigation and drop the state saved for the return, so none may run once
// the visitor is on the way out, and an unchanged URL must not write at all.
export function replaceListUrl(url: URL) {
  if (!isLeavingList && url.href !== window.location.href) {
    window.history.replaceState(null, "", url)
  }
}
