"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"

import {
  passkeySignIn,
  SignIn,
  usePasskeyWorks,
  useSignInFailed,
} from "@/components/sign-in"

// Comments load near the viewport; an editor opens only when someone wants to write. Writing
// needs someone signed in: the editor offers the ways to sign in, keeps the words while they are
// away, and has them waiting when they come back. Replies sit under the comment they answer, one
// level deep.

type Shown = {
  id: string
  name: string
  text: string
  at: string
  to: string | null
  canRemove: boolean
}

type Me = { name: string | null; signedIn: boolean; providers: string[] }

const day = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Pacific/Auckland",
})

const NOT_REMOVED_SIGNAL = "Not removed. Check your signal and try again."
const NOT_REMOVED_LATER = "Not removed. Please try again later."
const MAX = 1000
// Words waiting while their writer signs in somewhere else.
const DRAFT = "tn_draft"
const NEW = "new"

// Counted before the server tidies the text, so it is never too few.
function tooLong(text: string) {
  const over = [...text.trim()].length - MAX
  if (over <= 0) return "Please write up to 1000 characters."
  return `Please shorten it by ${over} character${over === 1 ? "" : "s"}.`
}

type Draft = { place: string; text: string; to: string }

function readDraft(place: string): Draft | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(DRAFT) ?? "null")
    return draft?.place === place && typeof draft.text === "string"
      ? draft
      : null
  } catch {
    return null
  }
}

function keepDraft(draft: Draft | null) {
  try {
    if (draft) sessionStorage.setItem(DRAFT, JSON.stringify(draft))
    else sessionStorage.removeItem(DRAFT)
  } catch {}
}

export function Comments({ place }: { place: string }) {
  const wrapper = useRef<HTMLDivElement>(null)
  // Which editor is open: a new comment, the reply to one thread, or none.
  const [open, setOpen] = useState<string | null>(null)
  const textField = useRef<HTMLTextAreaElement>(null)
  const trap = useRef<HTMLInputElement>(null)
  const nameField = useRef<HTMLInputElement>(null)
  const [comments, setComments] = useState<Shown[]>([])
  const [me, setMe] = useState<Me | null>(null)
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
  const signInFailed = useSignInFailed()
  const passkeyWorks = usePasskeyWorks()

  const signedIn = !!me?.signedIn
  // Until the list says otherwise, the reader is taken to be signed in: the server answers a
  // post from someone who isn't, and the editor then offers the ways to sign in.
  const showName = askName || (signedIn && !me?.name)

  useEffect(() => {
    const container = wrapper.current
    if (!container) return
    let isMounted = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let gaveUp = false
    let restored = false
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
          const providers = Array.isArray(json.providers) ? json.providers : []
          setMe((now) =>
            now
              ? { ...now, providers }
              : {
                  name: json.name ?? null,
                  signedIn: !!json.signedIn,
                  providers,
                }
          )
          // Back from signing in: the words written before are waiting in their editor.
          const draft = restored ? null : readDraft(place)
          restored = true
          if (draft) {
            setText(draft.text)
            setOpen(draft.to)
            requestAnimationFrame(() =>
              textField.current
                ?.closest("form")
                ?.scrollIntoView({ block: "center" })
            )
          }
        })
        .catch(again)
    }
    const wake = () => {
      if (gaveUp && document.visibilityState === "visible") load(0)
    }
    document.addEventListener("visibilitychange", wake)
    window.addEventListener("online", wake)
    let observer: IntersectionObserver | null = null
    if (readDraft(place)) load(2)
    else {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return
          observer?.disconnect()
          load(2)
        },
        { rootMargin: "600px 0px" }
      )
      observer.observe(container)
    }
    return () => {
      isMounted = false
      clearTimeout(timer)
      observer?.disconnect()
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

  useEffect(() => {
    if (open) textField.current?.focus({ preventScroll: true })
  }, [open])

  const ready = !!text.trim() && (!showName || !!name.trim())

  // Back to the button that opened the editor, which is drawn again once the editor goes.
  function close() {
    const target = open
    setOpen(null)
    setNote("")
    requestAnimationFrame(() =>
      wrapper.current
        ?.querySelector<HTMLButtonElement>(
          target === NEW
            ? '[data-testid="comment-open"]'
            : `[data-reply="${target}"]`
        )
        ?.focus()
    )
  }

  async function post(event: FormEvent) {
    event.preventDefault()
    if (busy || !ready || !open) return
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
          to: open === NEW ? undefined : open,
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
        setMe((now) => ({
          name: json.name,
          signedIn: true,
          providers: now?.providers ?? [],
        }))
        setText("")
        setName("")
        setAskName(false)
        // A new comment's editor stays for the next one; a reply's closes.
        if (open !== NEW) setOpen(null)
        keepDraft(null)
      } else {
        const error = await response
          .json()
          .then((json) => json?.error)
          .catch(() => null)
        if (response.status === 401) {
          setMe((now) => ({
            name: now?.name ?? null,
            signedIn: false,
            providers: now?.providers ?? [],
          }))
        } else if (response.status === 429)
          setNote("Not posted. Please try again later.")
        else if (response.status === 404 && error === "no such comment")
          setNote("That comment has just been removed.")
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

  // Threads in the order they were started; a thread whose first comment was removed keeps its
  // replies under a short "Removed".
  const byId = new Map(comments.map((c) => [c.id, c]))
  const replies = new Map<string, Shown[]>()
  const starts: string[] = []
  for (const comment of comments) {
    const thread = comment.to && comment.to !== comment.id ? comment.to : null
    if (!thread) {
      if (!starts.includes(comment.id)) starts.push(comment.id)
      continue
    }
    if (!replies.has(thread)) replies.set(thread, [])
    replies.get(thread)!.push(comment)
    if (!byId.has(thread) && !starts.includes(thread)) starts.push(thread)
  }
  starts.sort()

  const row = (comment: Shown) => (
    <li
      key={comment.id}
      ref={comment.id === fresh ? freshRow : undefined}
      tabIndex={comment.id === fresh ? -1 : undefined}
      data-testid="comment"
      className="py-4 outline-none"
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
  )

  const editor = (target: string) => {
    const replyingTo = target === NEW ? null : byId.get(target)?.name
    const back =
      typeof window === "undefined" ? `/${place}` : window.location.pathname
    return (
      <form
        id="comment-editor"
        data-testid="comment-form"
        onSubmit={(event) => void post(event)}
        className="relative space-y-3 py-4"
      >
        <textarea
          ref={textField}
          data-testid="comment-text-input"
          aria-label={target === NEW ? "Comment" : "Reply"}
          placeholder={
            target === NEW
              ? "A memory, a detail, a question…"
              : replyingTo
                ? `Reply to ${replyingTo.split(" ")[0]}…`
                : "Reply…"
          }
          rows={3}
          readOnly={busy}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setNote("")
          }}
          className="block w-full resize-y rounded-md border border-input bg-background px-3 py-3 text-lg leading-relaxed placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
        />
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
        {me && !signedIn ? (
          <>
            {(signInFailed || note) && (
              <p role="status" data-testid="comment-note" className="text-lg">
                {note || "Not signed in. Your words are still here."}
              </p>
            )}
            <SignIn
              providers={me.providers}
              back={back}
              onLeave={() => keepDraft({ place, text, to: target })}
              busy={busy}
              passkey={
                passkeyWorks
                  ? async () => {
                      setBusy(true)
                      setNote("")
                      keepDraft({ place, text, to: target })
                      const result = await passkeySignIn()
                      if (result === "ok") return window.location.reload()
                      keepDraft(null)
                      if (result === "failed")
                        setNote("Not signed in. Your words are still here.")
                      setBusy(false)
                    }
                  : undefined
              }
            />
            <button
              type="button"
              onClick={close}
              className="min-h-11 px-0 text-muted-foreground underline underline-offset-4"
            >
              Cancel
            </button>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="submit"
              data-testid="comment-post"
              disabled={!ready || busy}
              className="min-h-12 max-w-full rounded-md bg-foreground px-6 text-lg font-medium text-background disabled:opacity-50"
            >
              {me?.name && !showName ? `Post as ${me.name}` : "Post"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={close}
              className="min-h-11 px-2 text-muted-foreground underline underline-offset-4"
            >
              Cancel
            </button>
            {note && (
              <p role="status" data-testid="comment-note" className="text-lg">
                {note}
              </p>
            )}
          </div>
        )}
      </form>
    )
  }

  function start(target: string) {
    setOpen(target)
    setNote("")
    setAskName(false)
  }

  return (
    <div
      ref={wrapper}
      id="comments"
      data-testid="comments"
      className="mt-10 max-w-3xl"
    >
      {starts.length > 0 && (
        <ul data-testid="comments-list">
          {starts.map((id) => {
            const first = byId.get(id)
            const answers = replies.get(id) ?? []
            return (
              <li
                key={id}
                data-testid="comment-thread"
                className="border-b first:border-t"
              >
                <ul>
                  {first ? (
                    row(first)
                  ) : (
                    <li
                      data-testid="comment-removed"
                      className="py-4 text-sm text-muted-foreground"
                    >
                      Removed
                    </li>
                  )}
                </ul>
                {answers.length > 0 && (
                  <ul
                    data-testid="comment-replies"
                    className="ml-4 border-l pl-4 md:ml-6 md:pl-6"
                  >
                    {answers.map(row)}
                  </ul>
                )}
                {open === id ? (
                  <div className="ml-4 pl-4 md:ml-6 md:pl-6">{editor(id)}</div>
                ) : (
                  first && (
                    <button
                      type="button"
                      data-testid="comment-reply"
                      data-reply={id}
                      onClick={() => start(id)}
                      className={`-mt-2 mb-2 min-h-11 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground${answers.length ? " ml-4 pl-4 md:ml-6 md:pl-6" : ""}`}
                    >
                      Reply
                    </button>
                  )
                )}
              </li>
            )
          })}
        </ul>
      )}

      {open === NEW ? (
        <div className={starts.length ? "mt-2" : ""}>{editor(NEW)}</div>
      ) : (
        <button
          type="button"
          data-testid="comment-open"
          aria-expanded={false}
          onClick={() => start(NEW)}
          className={`min-h-11 text-muted-foreground underline underline-offset-4 hover:text-foreground${starts.length ? " mt-4" : ""}`}
        >
          Add a comment
        </button>
      )}
    </div>
  )
}
