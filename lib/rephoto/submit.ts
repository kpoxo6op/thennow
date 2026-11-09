// Sends a finished photograph to the site, for its owner to look at before anything is
// published. One key per photo, so pressing again or retrying never makes a second copy.

const TIMEOUT_MS = 60_000

export function newKey() {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("")
}

// offline: no answer at all (no signal, or a minute passed). busy: the site answered but couldn't
// take it just now. limited: too many photos from this network lately. refused: the site won't
// take this photo, however often it's sent.
export type SendResult = "sent" | "offline" | "busy" | "limited" | "refused"

export async function sendPhoto(
  file: Blob,
  { slug, key, checked }: { slug: string; key: string; checked: boolean }
): Promise<SendResult> {
  // Not keepalive: its body is capped at 64 KB. A plain request carries on if the page moves
  // on inside the site, and is given up after a minute so the button never spins for ever.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const query = new URLSearchParams({
      place: slug,
      key,
      checked: checked ? "1" : "0",
    })
    const response = await fetch(`/api/submit?${query}`, {
      method: "POST",
      headers: { "content-type": "image/jpeg" },
      body: file,
      signal: controller.signal,
    })
    if (response.ok) return "sent"
    if (response.status === 429) return "limited"
    if (response.status >= 500) return "busy"
    return "refused"
  } catch {
    return "offline"
  } finally {
    clearTimeout(timer)
  }
}
