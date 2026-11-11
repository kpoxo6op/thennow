"use client"

import { useId, useRef, useState } from "react"
import { CircleHelp, X } from "lucide-react"

export function ContributionDemo() {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const descriptionId = useId()

  function show() {
    setOpen(true)
    dialog.current?.showModal()
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label="Watch how to contribute"
        aria-haspopup="dialog"
        onClick={show}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <CircleHelp className="size-5" aria-hidden />
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => {
          setOpen(false)
          trigger.current?.focus()
        }}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-24px)] w-[min(780px,calc(100vw-24px))] overflow-auto rounded-xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/70"
      >
        <div className="flex items-center justify-between gap-4 px-4 py-1">
          <h2 id={titleId} className="font-medium">
            How to contribute
          </h2>
          <button
            type="button"
            aria-label="Close video"
            onClick={() => dialog.current?.close()}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:outline-2"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <p id={descriptionId} className="sr-only">
          Move your phone to line up the old photo with the scene. The orange
          ring shows alignment. Tap the shutter yourself, then Send photo. Your
          photo is received for review. You can take a photo before the ring
          turns orange.
        </p>
        {open && (
          <video
            className="block max-h-[calc(100dvh-80px)] w-full bg-black"
            src="/demo/contribute.mp4"
            poster="/demo/contribute.jpg"
            aria-label="Line up, take a photo, and send it for review"
            controls
            muted
            playsInline
            ref={(video) => {
              if (
                video &&
                !window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ) {
                void video.play().catch(() => {})
              }
            }}
          />
        )}
      </dialog>
    </>
  )
}
