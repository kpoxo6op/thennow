"use client"

import { useState, useSyncExternalStore } from "react"

import { matcherStatus, subscribeMatcher } from "@/lib/rephoto/local-matcher"

export function MatcherGuide({
  steady,
  hidden,
}: {
  steady: boolean
  hidden: boolean
}) {
  const status = useSyncExternalStore(
    subscribeMatcher,
    matcherStatus,
    matcherStatus
  )
  const [help, setHelp] = useState({ open: false, ready: false })
  const isReady = status.phase === "ready"
  const expanded = help.open && help.ready === isReady
  const unavailable =
    status.phase === "unsupported" || status.phase === "failed"
  const linedUp = status.phase === "ready" && steady
  const title = unavailable
    ? "Live guide unavailable"
    : linedUp
      ? "Lined up · Tap the photo button"
      : status.phase === "ready"
        ? "Live guide on · Looking for the scene"
        : status.phase === "starting"
          ? "Starting live guide…"
          : "Loading live guide…"
  const instruction = unavailable
    ? "Take a photo. We’ll try to line it up afterwards."
    : linedUp
      ? null
      : status.phase === "ready"
        ? "Orange ring means lined up. You can shoot anytime."
        : "Frame the scene. The old photo moves when matched. Take a photo anytime."

  return (
    <div
      hidden={hidden}
      data-testid="matcher-guide"
      data-state={status.phase}
      className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] mx-auto max-w-sm rounded-xl bg-black/85 px-3 py-2 text-sm leading-snug"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <p role="status" className="flex-1 font-medium">
          {title}
        </p>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="matcher-help"
          onClick={() => setHelp({ open: !expanded, ready: isReady })}
          className="min-h-11 min-w-11 shrink-0 underline underline-offset-4"
        >
          {expanded ? "Less" : "Guide"}
        </button>
      </div>
      {instruction && <p>{instruction}</p>}
      {status.phase === "loading" && status.downloaded != null && (
        <p
          className="mt-1 text-xs text-white/75"
          data-testid="matcher-progress"
        >
          Model downloaded: {(status.downloaded / 1_000_000).toFixed(1)} MB
        </p>
      )}
      <div
        id="matcher-help"
        hidden={!expanded}
        className="mt-2 max-h-[25dvh] overflow-y-auto border-t border-white/25 pt-2"
      >
        <p>
          {unavailable
            ? status.phase === "unsupported"
              ? "This browser can’t run the live guide. Chrome on a supported phone can show it."
              : "The guide couldn’t load or stopped working. We’ll try again while you frame."
            : "Move slowly. When the guide finds the scene, the old photo moves into place. An orange shutter ring means it’s lined up. Tap the photo button when you’re happy."}
        </p>
      </div>
    </div>
  )
}
