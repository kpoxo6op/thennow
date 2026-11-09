"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"

import { report } from "@/lib/rephoto/telemetry"

// After a photo is sent: the one, optional, way to put a name to it. Nothing here stands between
// the person and Done; it can be done now, later on Your photos, or never.

type Saving = "idle" | "saving" | "failed"

export async function saveName(name: string): Promise<string | null> {
  try {
    const response = await fetch("/api/me", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    })
    if (!response.ok) return null
    return (await response.json()).name ?? null
  } catch {
    return null
  }
}

export function AddName({ name: known }: { name: string | null }) {
  const [name, setName] = useState(known)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState<Saving>("idle")
  const [thanked, setThanked] = useState(false)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim() || saving === "saving") return
    setSaving("saving")
    const saved = await saveName(draft)
    report("name", {}, { result: saved ? "saved" : "failed" })
    if (!saved) return setSaving("failed")
    setName(saved)
    setThanked(true)
    setSaving("idle")
  }

  if (name)
    return (
      <p data-testid="rephoto-named" className="text-base text-white/85">
        {thanked ? `Thanks, ${name}.` : `Sent as ${name}.`}{" "}
        <Link
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
        onClick={() => setOpen(true)}
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
          id="rephoto-name"
          data-testid="rephoto-name"
          autoFocus
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
          disabled={!draft.trim() || saving === "saving"}
          className="min-h-12 rounded-md border border-white px-5 text-lg font-medium text-white disabled:opacity-50"
        >
          {saving === "saving" ? "Saving…" : "Save"}
        </button>
      </div>
      {saving === "failed" && (
        <p role="status" className="text-base text-white/85">
          Not saved. Check your signal and try again.
        </p>
      )}
    </form>
  )
}
