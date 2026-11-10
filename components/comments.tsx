"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"

// What visitors have written about a place, and a box to add to it. The list is fetched only as
// the reader nears it, so the place's page itself stays static. The box and button need no
// caption: the placeholder asks the question, and the button says what it does.

type Shown = {
  id: string
  name: string
  text: string
  at: string
  canRemove: boolean
}

const day = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Pacific/Auckland",
})

const NOT_REMOVED = "Not removed. Check your signal and try again."

export function Comments({ place }: { place: string }) {
  const wrapper = useRef<HTMLDivElement>(null)
  const trap = useRef<HTMLInputElement>(null)
  const [comments, setComments] = useState<Shown[]>([])
  const [known, setKnown] = useState<string | null | undefined>(undefined)
  const [askName, setAskName] = useState(false)
  const [text, setText] = useState("")
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const [removing, setRemoving] = useState<string | null>(null)
  const [failedRemoval, setFailedRemoval] = useState<string | null>(null)

  const showName = askName || known === null

  useEffect(() => {
    const container = wrapper.current
    if (!container) return
    let isMounted = true
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        fetch(`/api/comments?place=${encodeURIComponent(place)}`, {
          cache: "no-store",
        })
          .then(async (response) => {
            if (!response.ok) return
            const json = await response.json()
            if (!isMounted) return
            setComments(json.comments)
            setKnown(json.name)
          })
          .catch(() => {})
      },
      { rootMargin: "600px 0px" }
    )
    observer.observe(container)
    return () => {
      isMounted = false
      observer.disconnect()
    }
  }, [place])

  const ready = !!text.trim() && (!showName || !!name.trim())

  async function post(event: FormEvent) {
    event.preventDefault()
    if (busy || !ready) return
    setBusy(true)
    setNote("")
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          place,
          text,
          name: showName ? name : undefined,
          website: trap.current?.value ?? "",
        }),
      })
      if (response.ok) {
        const json = await response.json()
        setComments((now) => [...now, json.comment])
        setKnown(json.name)
        setText("")
        setName("")
        setAskName(false)
      } else {
        const error = await response
          .json()
          .then((json) => json?.error)
          .catch(() => null)
        if (response.status === 429)
          setNote("Not posted. Please try again later.")
        else if (response.status === 400 && error === "links")
          setNote("Please leave out links and web addresses.")
        else if (response.status === 400 && error === "name") {
          setAskName(true)
          setNote("Please add your name.")
        } else if (response.status === 400 && error === "text")
          setNote("Please write up to 1000 characters.")
        else setNote("Not posted. Check your signal and try again.")
      }
    } catch {
      setNote("Not posted. Check your signal and try again.")
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this?")) return
    setRemoving(id)
    setFailedRemoval(null)
    try {
      const response = await fetch(
        `/api/comments?place=${encodeURIComponent(place)}&id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      )
      if (response.ok) setComments((now) => now.filter((c) => c.id !== id))
      else setFailedRemoval(id)
    } catch {
      setFailedRemoval(id)
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div ref={wrapper} data-testid="comments" className="mt-10 max-w-3xl">
      {comments.length > 0 && (
        <ul data-testid="comments-list">
          {comments.map((comment) => (
            <li
              key={comment.id}
              data-testid="comment"
              className="border-b py-4 first:border-t"
            >
              <div className="flex items-baseline justify-between gap-4 text-sm text-muted-foreground">
                <p className="min-w-0">
                  <span data-testid="comment-name" className="text-foreground">
                    {comment.name}
                  </span>
                  {" · "}
                  <time data-testid="comment-date" dateTime={comment.at}>
                    {day.format(new Date(comment.at))}
                  </time>
                </p>
                {comment.canRemove && (
                  <button
                    type="button"
                    data-testid="comment-remove"
                    disabled={removing === comment.id}
                    onClick={() => void remove(comment.id)}
                    className="-my-3 shrink-0 py-3 underline underline-offset-4"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p
                data-testid="comment-text"
                className="mt-1 whitespace-pre-line break-words text-lg leading-relaxed"
              >
                {comment.text}
              </p>
              {failedRemoval === comment.id && (
                <p
                  role="status"
                  data-testid="comment-remove-note"
                  className="mt-2 text-sm text-muted-foreground"
                >
                  {NOT_REMOVED}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        data-testid="comment-form"
        onSubmit={(event) => void post(event)}
        className={`relative space-y-3${comments.length ? " mt-6" : ""}`}
      >
        {showName && (
          <input
            data-testid="comment-name-input"
            aria-label="Your name"
            placeholder="Your name"
            autoComplete="name"
            autoCapitalize="words"
            maxLength={60}
            readOnly={busy}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setNote("")
            }}
            className="block min-h-12 w-full max-w-md rounded-md border border-input bg-background px-3 text-lg placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
          />
        )}
        <textarea
          data-testid="comment-text-input"
          aria-label="Do you remember this place?"
          placeholder="Do you remember this place?"
          rows={5}
          maxLength={1000}
          readOnly={busy}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setNote("")
          }}
          className="block min-h-40 w-full resize-y rounded-md border border-input bg-background px-3 py-3 text-lg leading-relaxed placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
        />
        <input
          ref={trap}
          data-testid="comment-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="pointer-events-none absolute -left-[9999px] top-0 size-px opacity-0"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="submit"
            data-testid="comment-post"
            disabled={!ready || busy}
            className="min-h-12 rounded-md bg-foreground px-6 text-lg font-medium text-background disabled:opacity-50"
          >
            Post
          </button>
          {note && (
            <p role="status" data-testid="comment-note" className="text-lg">
              {note}
            </p>
          )}
        </div>
      </form>
    </div>
  )
}
