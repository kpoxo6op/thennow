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

const NOT_REMOVED_SIGNAL = "Not removed. Check your signal and try again."
const NOT_REMOVED_LATER = "Not removed. Please try again later."
const MAX = 1000

// Counted before the server tidies the text, so it is never too few.
function tooLong(text: string) {
  const over = [...text.trim()].length - MAX
  if (over <= 0) return "Please write up to 1000 characters."
  return `Please shorten it by ${over} character${over === 1 ? "" : "s"}.`
}

export function Comments({ place }: { place: string }) {
  const wrapper = useRef<HTMLDivElement>(null)
  const trap = useRef<HTMLInputElement>(null)
  const nameField = useRef<HTMLInputElement>(null)
  const [comments, setComments] = useState<Shown[]>([])
  const [known, setKnown] = useState<string | null | undefined>(undefined)
  const [askName, setAskName] = useState(false)
  const [text, setText] = useState("")
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const gone = useRef(new Set<string>())
  const freshRow = useRef<HTMLLIElement>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [failedRemoval, setFailedRemoval] = useState<{
    id: string
    note: string
  } | null>(null)

  const showName = askName || known === null

  useEffect(() => {
    const container = wrapper.current
    if (!container) return
    let isMounted = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let gaveUp = false
    // A list that cannot be read is tried again, quietly, a couple of times. What the reader has
    // written in the meantime stays, and so does what was removed: the list may have been asked for
    // before that. When the tries run out, the list is asked for once more each time the reader
    // comes back to the page or the phone finds its signal again.
    function load(retries: number) {
      gaveUp = false
      const again = () => {
        if (!isMounted) return
        if (retries > 0) timer = setTimeout(() => load(retries - 1), 4000)
        else gaveUp = true
      }
      fetch(`/api/comments?place=${encodeURIComponent(place)}`, {
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) {
            if (response.status >= 500) again()
            return
          }
          const json = await response.json()
          if (!isMounted) return
          setComments((now) => [
            ...json.comments
              .filter((c: Shown) => !gone.current.has(c.id))
              .map((c: Shown) => now.find((mine) => mine.id === c.id) ?? c),
            ...now.filter(
              (mine) => !json.comments.some((c: Shown) => c.id === mine.id)
            ),
          ])
          setKnown((now) => now ?? json.name)
        })
        .catch(again)
    }
    const wake = () => {
      if (gaveUp && document.visibilityState === "visible") load(0)
    }
    document.addEventListener("visibilitychange", wake)
    window.addEventListener("online", wake)
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        load(2)
      },
      { rootMargin: "600px 0px" }
    )
    observer.observe(container)
    return () => {
      isMounted = false
      clearTimeout(timer)
      observer.disconnect()
      document.removeEventListener("visibilitychange", wake)
      window.removeEventListener("online", wake)
    }
  }, [place])

  useEffect(() => {
    if (fresh) freshRow.current?.focus()
  }, [fresh])

  useEffect(() => {
    if (askName) nameField.current?.focus()
  }, [askName])

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
        // The list may have brought this comment already: then the answer takes its place, since
        // it knows the comment is this reader's.
        setComments((now) =>
          now.some((c) => c.id === json.comment.id)
            ? now.map((c) => (c.id === json.comment.id ? json.comment : c))
            : [...now, json.comment]
        )
        setFresh(json.comment.id)
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
        } else if (response.status === 400 && error === "refused") {
          if (trap.current) trap.current.value = ""
          setNote("Not posted. Please try again.")
        } else if (
          response.status === 413 ||
          (response.status === 400 && error === "text")
        )
          setNote(tooLong(text))
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
      if (response.ok || response.status === 404) {
        gone.current.add(id)
        setComments((now) => now.filter((c) => c.id !== id))
      } else setFailedRemoval({ id, note: NOT_REMOVED_LATER })
    } catch {
      setFailedRemoval({ id, note: NOT_REMOVED_SIGNAL })
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
              ref={comment.id === fresh ? freshRow : undefined}
              tabIndex={comment.id === fresh ? -1 : undefined}
              data-testid="comment"
              className="border-b py-4 first:border-t"
            >
              <div className="flex items-baseline justify-between gap-4 text-sm text-muted-foreground">
                <p className="min-w-0 break-words">
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
              {failedRemoval?.id === comment.id && (
                <p
                  role="status"
                  data-testid="comment-remove-note"
                  className="mt-2 text-sm text-muted-foreground"
                >
                  {failedRemoval.note}
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
            ref={nameField}
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
