"use client"

import { useEffect, useState, useSyncExternalStore } from "react"

import { matcherStatus, subscribeMatcher } from "@/lib/rephoto/local-matcher"

export function MatcherGuide({
  hidden,
  stable = false,
}: {
  hidden: boolean
  stable?: boolean
}) {
  const status = useSyncExternalStore(
    subscribeMatcher,
    matcherStatus,
    matcherStatus
  )
  const unavailable =
    status.phase === "unsupported" || status.phase === "failed"
  const [notice, setNotice] = useState({
    phase: status.phase,
    failed: unavailable,
    dismissed: false,
  })
  // Retries belong to the same failure episode. Only recovery permits a fresh notice.
  if (notice.phase !== status.phase) {
    setNotice({
      phase: status.phase,
      failed: status.phase === "ready" ? false : notice.failed || unavailable,
      dismissed: status.phase === "ready" ? false : notice.dismissed,
    })
  }
  useEffect(() => {
    if (!notice.failed) return
    const timer = setTimeout(
      () => setNotice((current) => ({ ...current, dismissed: true })),
      5000
    )
    return () => clearTimeout(timer)
  }, [notice.failed])

  const ready = status.phase === "ready"
  if (!ready && notice.dismissed) return null
  return (
    <div
      hidden={hidden}
      data-testid={ready ? "capture-guide" : "matcher-guide"}
      data-state={status.phase}
      className="pointer-events-none absolute left-[calc(max(0.75rem,env(safe-area-inset-left))+3.25rem)] right-[calc(max(0.75rem,env(safe-area-inset-right))+3.25rem)] top-[max(0.75rem,env(safe-area-inset-top))] text-center"
    >
      <div className="inline-flex max-w-full items-center gap-2 text-balance rounded-full bg-black/65 px-3 py-1.5 text-sm leading-5">
        <span role="status">
          {ready
            ? stable
              ? "Line up the edges, then tap"
              : "Find the view in the old photo"
            : notice.failed
              ? "Live guide unavailable"
              : status.phase === "starting"
                ? "Starting guide…"
                : "Loading guide…"}
        </span>
        {!notice.failed &&
          status.phase === "loading" &&
          status.downloaded != null && (
            <span
              data-testid="matcher-progress"
              className="hidden text-white/75 min-[400px]:inline"
            >
              {(status.downloaded / 1_000_000).toFixed(1)} MB
            </span>
          )}
      </div>
    </div>
  )
}
