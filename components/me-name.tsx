"use client"

import { useState, type FormEvent } from "react"

import { saveName } from "@/components/rephoto/add-name"

// The name that goes with this phone's photos: add it, change it, or take it away.

export function MeName({ name: saved }: { name: string | null }) {
  const [name, setName] = useState(saved)
  const [editing, setEditing] = useState(!saved)
  const [draft, setDraft] = useState(saved ?? "")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim() || busy) return
    setBusy(true)
    const result = await saveName(draft)
    setBusy(false)
    if (!("name" in result)) return setNote(result.note)
    setName(result.name)
    setDraft(result.name)
    setEditing(false)
    setNote("Saved.")
  }

  const remove = async () => {
    if (busy) return
    setBusy(true)
    try {
      const response = await fetch("/api/me", { method: "DELETE" })
      if (!response.ok) throw new Error(String(response.status))
      setName(null)
      setDraft("")
      setEditing(true)
      setNote("Your name is removed.")
    } catch {
      setNote("Not removed. Check your signal and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-testid="me-name" className="space-y-3">
      {name && !editing ? (
        <p className="text-lg">
          Credited as <span data-testid="me-name-value" className="font-medium">{name}</span>.{" "}
          <button
            type="button"
            data-testid="me-name-change"
            onClick={() => {
              setEditing(true)
              setNote("")
            }}
            className="-my-2 py-2 underline underline-offset-4"
          >
            Change
          </button>{" "}
          ·{" "}
          <button
            type="button"
            data-testid="me-name-remove"
            disabled={busy}
            onClick={() => void remove()}
            className="-my-2 py-2 underline underline-offset-4"
          >
            Remove
          </button>
        </p>
      ) : (
        <form onSubmit={(event) => void save(event)} className="space-y-2">
          <label htmlFor="me-name" className="block text-lg">
            Add your name. If we publish your photos, we’ll credit this name.
          </label>
          <div className="flex max-w-md gap-2">
            <input
              id="me-name"
              data-testid="me-name-input"
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="done"
              maxLength={60}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Your name"
              className="min-h-12 min-w-0 flex-1 rounded-md border bg-background px-3 text-lg focus:border-foreground focus:outline-none"
            />
            <button
              type="submit"
              data-testid="me-name-save"
              disabled={!draft.trim() || busy}
              className="min-h-12 rounded-md bg-foreground px-5 text-lg font-medium text-background disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
      {note && (
        <p role="status" data-testid="me-name-note" className="text-base text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  )
}
