import { randomBytes } from "crypto"

import { del, get, list, put } from "@/lib/store"

// What visitors write at the end of a place's page. A comment is its words, the name it was
// posted with, when, and the id of the person who wrote it, kept as one small file at
// comments/<place>/<key>.json in the private store. A key starts with the time, so the files sort
// oldest first. No address is kept, and the person's id never leaves the server: the browser is
// only told whether it may remove a comment.

export const MAX_TEXT = 1000

// 13 digits of milliseconds, then 8 hex characters: sorts by time, never collides in practice.
export const KEY = /^\d{13}-[0-9a-f]{8}$/

export type Comment = {
  key: string
  text: string
  name: string
  by: string
  at: string
}

export const commentPath = (place: string, key: string) =>
  `comments/${place}/${key}.json`

export function cleanText(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const text = raw
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  if (!text || [...text].length > MAX_TEXT) return null
  return text
}

// The endings are few on purpose: people often forget the space after a full stop ("there.My
// mother"), and many two-letter endings are also English words.
const LINK =
  /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|nz|au|uk|info|biz|ru|cn|xyz|io|ly)\b/i

export const hasLink = (text: string) => LINK.test(text)

// Read on every call, so a change in the environment is seen without a restart.
export function adminIds(): Set<string> {
  return new Set(
    (process.env.TN_ADMIN_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^[0-9a-f]{32}$/.test(id))
  )
}

// A place's list is remembered for a few seconds, so a busy page doesn't list the store each time.
// A stored comment never changes, so it is read from the store once per server.
const FRESH_MS = 20_000
const READ_AT_ONCE = 10
const lists = new Map<string, { at: number; comments: Comment[] }>()
const bodies = new Map<string, Comment>()
// How many times a place's comments have changed here: a list read while one changed may be out
// of date, so it is not kept.
const changed = new Map<string, number>()
const changedCount = (place: string) => changed.get(place) ?? 0
const changes = (place: string) => changed.set(place, changedCount(place) + 1)

function parse(key: string, raw: string): Comment | null {
  try {
    const found = JSON.parse(raw)
    if (
      typeof found?.text !== "string" ||
      typeof found?.name !== "string" ||
      typeof found?.by !== "string" ||
      typeof found?.at !== "string"
    )
      return null
    return {
      key,
      text: found.text,
      name: found.name,
      by: found.by,
      at: found.at,
    }
  } catch {
    return null
  }
}

async function readPath(
  place: string,
  key: string,
  cached: boolean
): Promise<Comment | null> {
  const pathname = commentPath(place, key)
  if (cached) {
    const kept = bodies.get(pathname)
    if (kept) return kept
  }
  const found = await get(pathname, { access: "private", useCache: false })
  if (!found || found.statusCode !== 200) return null
  const comment = parse(key, await new Response(found.stream).text())
  if (comment && cached) {
    if (bodies.size > 5000) bodies.clear()
    bodies.set(pathname, comment)
  }
  return comment
}

export async function listComments(place: string): Promise<Comment[]> {
  const fresh = lists.get(place)
  if (fresh && Date.now() - fresh.at < FRESH_MS) return fresh.comments

  const before = changedCount(place)
  const page = await list({ prefix: `comments/${place}/`, limit: 1000 })
  const keys = page.blobs
    .map(
      (blob) =>
        blob.pathname
          .split("/")
          .pop()
          ?.replace(/\.json$/, "") ?? ""
    )
    .filter((key) => KEY.test(key))
  const comments: Comment[] = []
  for (let start = 0; start < keys.length; start += READ_AT_ONCE) {
    const read = await Promise.all(
      keys
        .slice(start, start + READ_AT_ONCE)
        .map((key) => readPath(place, key, true))
    )
    for (const comment of read) if (comment) comments.push(comment)
  }
  if (changedCount(place) !== before) return listComments(place)
  lists.set(place, { at: Date.now(), comments })
  return comments
}

export async function addComment(
  place: string,
  { text, name, by }: { text: string; name: string; by: string }
): Promise<Comment> {
  const key =
    String(Date.now()).padStart(13, "0") + "-" + randomBytes(4).toString("hex")
  const at = new Date().toISOString()
  await put(commentPath(place, key), JSON.stringify({ text, name, by, at }), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
  })
  const comment = { key, text, name, by, at }
  if (bodies.size > 5000) bodies.clear()
  bodies.set(commentPath(place, key), comment)
  lists.get(place)?.comments.push(comment)
  changes(place)
  return comment
}

// Always from the store: whether someone may remove a comment is decided on what is kept.
export const readComment = (place: string, key: string) =>
  readPath(place, key, false)

export async function removeComment(place: string, key: string) {
  await del(commentPath(place, key))
  bodies.delete(commentPath(place, key))
  const kept = lists.get(place)
  if (kept) kept.comments = kept.comments.filter((c) => c.key !== key)
  changes(place)
}
