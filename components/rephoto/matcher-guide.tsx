"use client"

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import { matcherStatus, subscribeMatcher } from "@/lib/rephoto/local-matcher"

export function MatcherGuide({
  hidden,
  found = false,
  message,
  icon,
  badge,
  lined = false,
  label,
}: {
  hidden: boolean
  found?: boolean
  message?: string
  // A small sign before the words: which way to move.
  icon?: ReactNode
  // How well the view lines up, out of 100, after the words.
  badge?: number
  // Green only when the camera says lined up: a high number over too few lines isn't.
  lined?: boolean
  // Said to screen readers when there are no words on screen.
  label?: string
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
  // Nothing to show: no pill at all rather than an empty one.
  if (ready && message === "" && !icon && badge == null)
    return label ? (
      <span role="status" className="sr-only">
        {label}
      </span>
    ) : null
  return (
    <div
      hidden={hidden}
      data-testid={ready ? "capture-guide" : "matcher-guide"}
      data-state={status.phase}
      style={
        message
          ? { right: "calc(max(0.75rem, env(safe-area-inset-right)) + 7rem)" }
          : undefined
      }
      className="pointer-events-none absolute left-[calc(max(0.75rem,env(safe-area-inset-left))+3.25rem)] right-[calc(max(0.75rem,env(safe-area-inset-right))+3.25rem)] top-[max(0.75rem,env(safe-area-inset-top))] text-center"
    >
      <div className="inline-flex max-w-full items-center gap-2 text-balance rounded-full bg-black/65 px-3 py-1.5 text-sm leading-5">
        {ready && icon}
        {ready && message === "" && label && (
          <span role="status" className="sr-only">
            {label}
          </span>
        )}
        <span role="status" hidden={ready && message === ""}>
          {ready
            ? (message ??
              (found
                ? "Scene found · Slide to compare"
                : "Point at the view in the old photo"))
            : notice.failed
              ? "Scene matcher unavailable"
              : status.phase === "starting"
                ? "Starting scene matcher…"
                : "Loading scene matcher…"}
        </span>
        {ready && badge != null && (
          <span
            data-testid="live-score"
            className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${lined ? "bg-lime-300 text-black" : badge >= 60 ? "bg-amber-300 text-black" : "bg-white/20 text-white"}`}
          >
            {badge}
          </span>
        )}
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
