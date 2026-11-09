"use client"

import { useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { flushSync } from "react-dom"

import { report } from "@/lib/rephoto/telemetry"

// After a photo is sent: the one, optional, way to put a name to it. Nothing here stands between
// the person and Done; it can be done now, later on Your photos, or never.

export type Saved = { name: string } | { note: string }

const NOTES: Record<number, string> = {
  401: "Not saved yet. Please try again in a moment.",
  429: "Not saved. Please try again later.",
}
const OFFLINE = "Not saved. Check your signal and try again."

export async function saveName(
  name: string,
  sent?: { place: string; key: string }
): Promise<Saved> {
  try {
    const response = await fetch("/api/me", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, ...sent }),
    })
    if (!response.ok) return { note: NOTES[response.status] ?? OFFLINE }
    const saved = (await response.json()).name
    return typeof saved === "string" ? { name: saved } : { note: OFFLINE }
  } catch {
    return { note: OFFLINE }
  }
}

interface Props {
  // The name this phone already has, if any.
  name: string | null
  // The photo just sent, which proves this phone has one even before it's listed.
  sent: { place: string; key: string }
}

export function AddName({ name: known, sent }: Props) {
  const [saved, setSaved] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState("")
  const [thanked, setThanked] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const after = useRef<HTMLAnchorElement>(null)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim() || saving) return
    setSaving(true)
    setNote("")
    const result = await saveName(draft, sent)
    setSaving(false)
    report("name", {}, { result: "name" in result ? "saved" : result.note.slice(0, 40) })
    if (!("name" in result)) return setNote(result.note)
    flushSync(() => {
      setSaved(result.name)
      setThanked(true)
    })
    after.current?.focus()
  }

  // A name that arrives late shows, unless the person has already started typing one.
  const name = saved ?? (open ? null : known)
  if (name)
    return (
      <p data-testid="rephoto-named" className="text-base text-white/85">
        {thanked ? `Thanks, ${name}.` : `Sent as ${name}.`}{" "}
        <Link
          ref={after}
          href="/me"
          data-testid="rephoto-your-photos"
          className="inline-flex min-h-11 items-center text-white underline underline-offset-4"
        >
          Your photos
        </Link>
      </p>
    )

  if (!open)
    return (
      <button
        type="button"
        data-testid="rephoto-add-name"
        onClick={() => {
          // Focused within the tap itself, or an iPhone won't bring up its keyboard.
          flushSync(() => setOpen(true))
          field.current?.focus()
        }}
        className="min-h-11 text-base text-white/85 underline underline-offset-4"
      >
        Add your name
      </button>
    )

  return (
    <form
      data-testid="rephoto-name-form"
      onSubmit={(event) => void save(event)}
      className="w-full max-w-sm space-y-2 text-left"
    >
      <label htmlFor="rephoto-name" className="block text-base text-white/85">
        If we publish your photo, we’ll credit this name.
      </label>
      <div className="flex gap-2">
        <input
          ref={field}
          id="rephoto-name"
          data-testid="rephoto-name"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="done"
          maxLength={60}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Your name"
          className="min-h-12 min-w-0 flex-1 rounded-md border border-white/40 bg-white/10 px-3 text-lg text-white placeholder:text-white/50 focus:border-white focus:outline-none"
        />
        <button
          type="submit"
          data-testid="rephoto-name-save"
          disabled={!draft.trim() || saving}
          className="min-h-12 rounded-md border border-white px-5 text-lg font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {note && (
        <p role="status" className="text-base text-white/85">
          {note}
        </p>
      )}
    </form>
  )
}
