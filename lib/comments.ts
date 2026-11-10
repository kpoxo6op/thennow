import { randomBytes } from "crypto"

import { del, get, list, put } from "@/lib/store"

// What visitors write at the end of a place's page. A comment is its words, the name it was
// posted with, when, and the id of the person who wrote it, kept as one small file at
// comments/<place>/<key>.json in the private store. A key starts with the time, so the files sort
// oldest first. No address is kept, and the person's id never leaves the server: the browser is
// only told whether it may remove a comment. A stored comment changes only when its writer signs
// in on another phone, and the comment then moves to the person's own id.

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

// A list is never kept here: each server instance would keep its own, and a comment posted
// through one would be missing from another's for a while. A comment that has been read is kept,
// and read again only when the store says its file has been written since.
const READ_AT_ONCE = 10
const bodies = new Map<string, { stamp: number; comment: Comment }>()

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

async function everything(prefix: string) {
  const found: { pathname: string; uploadedAt: Date }[] = []
  let cursor: string | undefined
  do {
    const page = await list({ prefix, cursor, limit: 1000 })
    found.push(...page.blobs)
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  return found
}

async function readFromStore(
  place: string,
  key: string
): Promise<Comment | null> {
  const found = await get(commentPath(place, key), {
    access: "private",
    useCache: false,
  })
  if (!found || found.statusCode !== 200) return null
  return parse(key, await new Response(found.stream).text())
}

async function readListed(
  place: string,
  key: string,
  stamp: number
): Promise<Comment | null> {
  const pathname = commentPath(place, key)
  const kept = bodies.get(pathname)
  if (kept && kept.stamp === stamp) return kept.comment
  const comment = await readFromStore(place, key)
  if (comment) {
    if (bodies.size > 5000) bodies.clear()
    bodies.set(pathname, { stamp, comment })
  }
  return comment
}

export async function listComments(place: string): Promise<Comment[]> {
  const files = (await everything(`comments/${place}/`))
    .map((blob) => ({
      key:
        blob.pathname
          .split("/")
          .pop()
          ?.replace(/\.json$/, "") ?? "",
      stamp: blob.uploadedAt.getTime(),
    }))
    .filter((file) => KEY.test(file.key))
  const comments: Comment[] = []
  for (let start = 0; start < files.length; start += READ_AT_ONCE) {
    const read = await Promise.all(
      files
        .slice(start, start + READ_AT_ONCE)
        .map((file) => readListed(place, file.key, file.stamp))
    )
    for (const comment of read) if (comment) comments.push(comment)
  }
  return comments.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

// A tiny note that this person wrote that comment, so signing in can find a person's comments
// without reading everyone's.
export const markPath = (by: string, place: string, key: string) =>
  `commented/${by}/${place}/${key}`

const mark = (by: string, place: string, key: string, at: string) =>
  put(markPath(by, place, key), at, {
    access: "private",
    contentType: "text/plain",
    addRandomSuffix: false,
    allowOverwrite: true,
  })

export async function addComment(
  place: string,
  { text, name, by }: { text: string; name: string; by: string }
): Promise<Comment> {
  const key =
    String(Date.now()).padStart(13, "0") + "-" + randomBytes(4).toString("hex")
  const at = new Date().toISOString()
  // The note comes first: a note with no comment is harmless, but a comment with no note could
  // not follow its writer.
  await mark(by, place, key, at)
  await put(commentPath(place, key), JSON.stringify({ text, name, by, at }), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
  })
  return { key, text, name, by, at }
}

// Always from the store: whether someone may remove a comment is decided on what is kept.
export const readComment = readFromStore

export async function removeComment(place: string, comment: Comment) {
  await del([
    commentPath(place, comment.key),
    markPath(comment.by, place, comment.key),
  ])
  bodies.delete(commentPath(place, comment.key))
}

// When someone signs in on a phone that had already written comments, those comments join theirs.
// Each comment is rewritten under the new id before the old note goes, and its new note is put
// before the old one is deleted, so a move that stops half-way is finished by signing in again.
export async function moveComments(from: string, to: string) {
  if (from === to) return
  const prefix = `commented/${from}/`
  const found = await everything(prefix)

  for (let start = 0; start < found.length; start += READ_AT_ONCE) {
    await Promise.all(
      found.slice(start, start + READ_AT_ONCE).map(async ({ pathname }) => {
        const [place, key] = pathname.slice(prefix.length).split("/")
        if (!place || !key || !KEY.test(key)) return
        const comment = await readComment(place, key)
        if (comment && comment.by === from) {
          const { text, name, at } = comment
          await put(
            commentPath(place, key),
            JSON.stringify({ text, name, by: to, at }),
            {
              access: "private",
              contentType: "application/json",
              addRandomSuffix: false,
              allowOverwrite: true,
            }
          )
          await mark(to, place, key, at)
        } else if (comment && comment.by === to) {
          await mark(to, place, key, comment.at)
        }
        await del(pathname)
      })
    )
  }
}
