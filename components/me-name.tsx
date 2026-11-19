"use client"

import { useRef, useState, useSyncExternalStore, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { startRegistration } from "@simplewebauthn/browser"
import { flushSync } from "react-dom"

import { passkeySignIn, SignIn, useSignInFailed } from "@/components/sign-in"

// Signing in is one tap on an account people already have (lib/auth), or a passkey. Without
// either, a name alone still signs up: the phone then saves a passkey for it, which is how the
// same person signs in on another device, or on this one after its browser is cleared.

const OFFLINE = "Not saved. Check your signal and try again."
const json = { "content-type": "application/json" }
const noStore = () => () => {}

type Me = { name: string; passkey: boolean }

async function saveName(name: string): Promise<Me | { note: string }> {
  try {
    const response = await fetch("/api/me", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ name }),
    })
    if (response.status === 429)
      return { note: "Not saved. Please try again later." }
    if (!response.ok) return { note: OFFLINE }
    const me = await response.json()
    return typeof me?.name === "string"
      ? { name: me.name, passkey: !!me.passkey }
      : { note: OFFLINE }
  } catch {
    return { note: OFFLINE }
  }
}

// Never in the way: a phone that can't keep a passkey, or a person who declines, stays signed up
// on this browser, and is offered the passkey again the next time the name is saved.
async function savePasskey() {
  try {
    const options = await fetch("/api/me/passkey", { cache: "no-store" })
    if (!options.ok) return
    const response = await startRegistration({
      optionsJSON: await options.json(),
    })
    await fetch("/api/me/passkey", {
      method: "POST",
      headers: json,
      body: JSON.stringify(response),
    })
  } catch {}
}

export function MeName({
  name: saved,
  passkey,
  verified,
  providers,
}: {
  name: string | null
  passkey: boolean
  verified: boolean
  providers: string[]
}) {
  const router = useRouter()
  const [name, setName] = useState(saved)
  const [editing, setEditing] = useState(!saved)
  const [draft, setDraft] = useState(saved ?? "")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  // Without another account, a name and a passkey still sign someone up; that way waits behind a
  // link while the accounts are offered.
  const [byPasskey, setByPasskey] = useState(!providers.length)
  const field = useRef<HTMLInputElement>(null)
  const signInFailed = useSignInFailed()
  const canSignIn = useSyncExternalStore(
    noStore,
    () => "PublicKeyCredential" in window,
    () => false
  )

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim() || busy) return
    setBusy(true)
    setNote("")
    const result = await saveName(draft)
    if ("note" in result) {
      setBusy(false)
      return setNote(result.note)
    }
    setName(result.name)
    setDraft(result.name)
    setEditing(false)
    if (!result.passkey && !verified && canSignIn) await savePasskey()
    setBusy(false)
    router.refresh()
  }

  const signIn = async () => {
    if (busy) return
    setBusy(true)
    setNote("")
    const result = await passkeySignIn()
    // The whole page again, now with this person's cookie.
    if (result === "ok") return window.location.reload()
    if (result === "failed") setNote("Not signed in. Please try again.")
    setBusy(false)
  }

  const signOut = async () => {
    if (busy) return
    setBusy(true)
    try {
      const response = await fetch("/api/auth/signout", { method: "POST" })
      if (!response.ok) throw new Error(String(response.status))
      window.location.reload()
    } catch {
      setNote("Not signed out. Check your signal and try again.")
      setBusy(false)
    }
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
          Credited as{" "}
          <span data-testid="me-name-value" className="font-medium">
            {name}
          </span>
          .{" "}
          <button
            type="button"
            data-testid="me-name-change"
            onClick={() => {
              // Focused within the tap itself, so the keyboard comes up straight away.
              flushSync(() => {
                setEditing(true)
                setNote("")
              })
              field.current?.focus()
            }}
            className="-my-2 py-2 underline underline-offset-4"
          >
            Change
          </button>{" "}
          ·{" "}
          {verified ? (
            <button
              type="button"
              data-testid="me-sign-out"
              disabled={busy}
              onClick={() => void signOut()}
              className="-my-2 py-2 underline underline-offset-4"
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              data-testid="me-name-remove"
              disabled={busy}
              onClick={() => void remove()}
              className="-my-2 py-2 underline underline-offset-4"
            >
              Remove
            </button>
          )}
        </p>
      ) : (
        <>
          {!name && (
            <p className="text-lg">
              {verified
                ? "Add your name to be credited for your photos."
                : "Sign in to be credited for your photos."}
            </p>
          )}
          {!name && !verified && (
            <SignIn
              providers={providers}
              back="/me"
              passkey={canSignIn ? () => void signIn() : undefined}
              busy={busy}
            />
          )}
          {!name && !verified && !byPasskey && canSignIn && (
            <button
              type="button"
              data-testid="me-passkey-signup"
              onClick={() => {
                flushSync(() => setByPasskey(true))
                field.current?.focus()
              }}
              className="block py-2 text-base text-muted-foreground underline underline-offset-4"
            >
              Sign up with a passkey instead
            </button>
          )}
          <form
            hidden={!name && !verified && !byPasskey}
            onSubmit={(event) => void save(event)}
            className={`flex max-w-md gap-2${!name && !verified ? " pt-4" : ""}`}
          >
            <input
              ref={field}
              data-testid="me-name-input"
              aria-label="Your name"
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
              {name || verified ? "Save" : "Sign up"}
            </button>
          </form>
        </>
      )}
      {!name && verified && (
        <button
          type="button"
          data-testid="me-sign-out"
          disabled={busy}
          onClick={() => void signOut()}
          className="block py-2 text-base underline underline-offset-4"
        >
          Sign out
        </button>
      )}
      {name && !verified && !editing && (
        <p className="pt-2 text-lg">
          Sign in to comment and to keep your name on every device.
        </p>
      )}
      {name && !verified && !editing && (
        <SignIn
          providers={providers}
          back="/me"
          passkey={canSignIn ? () => void signIn() : undefined}
          busy={busy}
        />
      )}
      {signInFailed && !note && (
        <p role="status" className="text-base text-muted-foreground">
          Not signed in. Please try again.
        </p>
      )}
      {note && (
        <p
          role="status"
          data-testid="me-name-note"
          className="text-base text-muted-foreground"
        >
          {note}
        </p>
      )}
    </div>
  )
}
