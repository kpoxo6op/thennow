"use client"

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { startAuthentication } from "@simplewebauthn/browser"

// One quiet list of the accounts people can sign in with, all in the site's own type and colour:
// no provider's script, button or colours. Each row is a plain link to /api/auth/<provider>.

const LABEL: Record<string, string> = {
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
  microsoft: "Microsoft",
  test: "Test",
}

const glyph = "size-5 shrink-0"

const ICON: Record<string, ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={glyph}>
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.83h5.4a4.62 4.62 0 0 1-2 3.03v2.5h3.24c1.9-1.75 2.96-4.33 2.96-7.34ZM12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.5c-.9.6-2.05.95-3.39.95-2.6 0-4.81-1.76-5.6-4.12H3.07v2.58A10 10 0 0 0 12 22Zm-5.6-8.1a6 6 0 0 1 0-3.8V7.52H3.07a10 10 0 0 0 0 8.96L6.4 13.9ZM12 5.98c1.47-.02 2.88.53 3.95 1.54l2.94-2.94A9.9 9.9 0 0 0 12 2a10 10 0 0 0-8.93 5.52L6.4 10.1C7.18 7.74 9.4 5.98 12 5.98Z"
      />
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={glyph}>
      <path
        fill="currentColor"
        d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46a4.22 4.22 0 0 0-3.32-1.8c-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3-.79a4.45 4.45 0 0 0-3.76 2.28c-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23a9.8 9.8 0 0 0 1.25-2.57 3.97 3.97 0 0 1-2.37-3.7ZM14.1 5.86A3.97 3.97 0 0 0 15.04 3a4.04 4.04 0 0 0-2.62 1.35 3.78 3.78 0 0 0-.96 2.76 3.34 3.34 0 0 0 2.64-1.25Z"
      />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={glyph}>
      <path
        fill="currentColor"
        d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.49-3.91 3.78-3.91 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.9h-2.33V22A10.04 10.04 0 0 0 22 12.06Z"
      />
    </svg>
  ),
  microsoft: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={glyph}>
      <path
        fill="currentColor"
        d="M3 3h8.5v8.5H3V3Zm9.5 0H21v8.5h-8.5V3ZM3 12.5h8.5V21H3v-8.5Zm9.5 0H21V21h-8.5v-8.5Z"
      />
    </svg>
  ),
  passkey: (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={glyph}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="4" />
      <path d="M3 21v-1.5A4.5 4.5 0 0 1 7.5 15h1M15 13.5a3 3 0 1 0 3 3v4.5l1.5-1.5-1.5-1.5 1.5-1.5" />
    </svg>
  ),
}

const noStore = () => () => {}

// Apple first on Apple's own devices, Google first elsewhere. Google refuses to sign in inside
// the browsers built into apps like Facebook and Instagram, so it isn't offered there.
export function useOrder(providers: string[]) {
  const agent = useSyncExternalStore(
    noStore,
    () => navigator.userAgent,
    () => ""
  )
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|; wv\)/.test(agent)
  const apple = /iPhone|iPad|Macintosh/.test(agent)
  const list = providers.filter((p) => !(inApp && p === "google"))
  return apple && list.includes("apple")
    ? ["apple", ...list.filter((p) => p !== "apple")]
    : list
}

export const row =
  "flex min-h-12 w-full items-center gap-3 rounded-md border px-4 text-left text-lg hover:border-foreground focus-visible:border-foreground focus-visible:outline-none disabled:opacity-50"

export function SignIn({
  providers,
  back,
  onLeave,
  passkey,
  busy,
}: {
  providers: string[]
  back: string
  onLeave?: () => void
  passkey?: () => void
  busy?: boolean
}) {
  const order = useOrder(providers)
  return (
    <div data-testid="sign-in" className="grid max-w-sm gap-2">
      {order.map((provider) => (
        <a
          key={provider}
          data-testid={`sign-in-${provider}`}
          href={`/api/auth/${provider}?back=${encodeURIComponent(back)}`}
          onClick={onLeave}
          className={row}
        >
          {ICON[provider]}
          Continue with {LABEL[provider] ?? provider}
        </a>
      ))}
      {passkey && (
        <button
          type="button"
          data-testid="me-sign-in"
          disabled={busy}
          onClick={passkey}
          className={row}
        >
          {ICON.passkey}
          Use a passkey
        </button>
      )}
    </div>
  )
}

// After a failed trip to a provider, the site comes back with #signin-failed. The note is shown
// once, and the address is put back as it was.
export function useSignInFailed() {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (window.location.hash !== "#signin-failed") return
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search
    )
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFailed(true)
  }, [])
  return failed
}

// Signing in with a passkey saved earlier. "closed" is the person closing their phone's own sheet,
// which is an answer, not a failure. On "ok" the browser has the person's cookie.
export async function passkeySignIn(): Promise<"ok" | "closed" | "failed"> {
  try {
    const options = await fetch("/api/me/signin", { cache: "no-store" })
    if (!options.ok) return "failed"
    const response = await startAuthentication({
      optionsJSON: await options.json(),
    })
    const done = await fetch("/api/me/signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(response),
    })
    return done.ok ? "ok" : "failed"
  } catch (error) {
    return error instanceof Error && /NotAllowed|Abort/.test(error.name)
      ? "closed"
      : "failed"
  }
}

export const usePasskeyWorks = () =>
  useSyncExternalStore(
    noStore,
    () => "PublicKeyCredential" in window,
    () => false
  )
