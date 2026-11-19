import { fetchPending, fetchPosts } from "@/lib/api"
import { configured } from "@/lib/auth"
import {
  addComment,
  adminIds,
  cleanText,
  hasLink,
  KEY,
  listComments,
  readComment,
  removeComment,
  type Comment,
} from "@/lib/comments"
import { limiter, sameSite } from "@/lib/limit"
import {
  cleanName,
  isVerified,
  personId,
  readCookie,
  readProfile,
  writeProfile,
} from "@/lib/people"
import { hasStore, memoryStore } from "@/lib/store"

// What visitors write at the end of a place's page: the list, a new comment or reply, and removing
// one. Anyone can read; writing needs someone signed in, with a passkey or another account
// (lib/auth), so a name under a comment is always the same person's. The answer never says who
// wrote what, only whether this browser may remove a comment (its own, or any for an admin).

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Posting: five an hour from one network. The count is kept per server instance (see
// lib/limit.ts), so on the site it is a rough limit.
const posts = limiter(5, 60 * 60_000)
// And twenty an hour from one person, wherever they are.
const perPerson = new Map<string, number[]>()
function personAllowed(id: string) {
  const now = Date.now()
  const times = (perPerson.get(id) ?? []).filter((t) => now - t < 60 * 60_000)
  if (times.length >= 20) return false
  times.push(now)
  perPerson.set(id, times)
  if (perPerson.size > 10_000) perPerson.clear()
  return true
}
// Everything that reaches the store on someone's say-so counts here first.
const knocks = limiter(60, 60 * 60_000)
const reads = limiter(600, 60 * 60_000)

const MAX_BODY = 12_000

function refuse(status: number, error: string) {
  return Response.json(
    { error },
    { status, headers: { "cache-control": "private, no-store" } }
  )
}

function answer(body: Record<string, unknown>, headers: HeadersInit = {}) {
  return Response.json(body, {
    headers: {
      "cache-control": "private, no-store",
      // Only the test suite's server says this; its tests check it before writing anything.
      ...(memoryStore ? { "x-tn-store": "memory" } : {}),
      ...headers,
    },
  })
}

async function realPlace(slug: string) {
  const places = [...(await fetchPosts()), ...(await fetchPending())]
  return places.some((place) => place.slug === slug && !place.sample)
}

// A saved name with a web address cannot sign a comment, so it is treated as if there were none.
const usable = (name: string | undefined | null) =>
  name && !hasLink(name) ? name : null

function shown(comment: Comment, id: string | null, admins: Set<string>) {
  return {
    id: comment.key,
    name: comment.name,
    text: comment.text,
    at: comment.at,
    to: comment.to ?? null,
    canRemove: !!id && (comment.by === id || admins.has(id)),
  }
}

export async function GET(request: Request) {
  const place = new URL(request.url).searchParams.get("place") ?? ""
  if (!(await realPlace(place))) return refuse(404, "no such place")
  if (!reads(request)) return refuse(429, "slow down")
  const providers = configured()
  if (!hasStore())
    return answer({ comments: [], name: null, signedIn: false, providers })

  // No cookie is made here.
  const cookie = readCookie(request)
  const id = cookie ? personId(cookie) : null
  try {
    const [comments, profile] = await Promise.all([
      listComments(place),
      id ? readProfile(id) : null,
    ])
    const admins = adminIds()
    return answer({
      comments: comments.map((comment) => shown(comment, id, admins)),
      name: usable(profile?.name),
      signedIn: isVerified(profile),
      providers,
    })
  } catch (error) {
    console.error(`comments failed ${String(error).slice(0, 300)}`)
    return refuse(502, "store failed")
  }
}

export async function POST(request: Request) {
  if (!sameSite(request)) return refuse(403, "forbidden")
  // A form on another site can only send plain text, and browsers too old to say where a request
  // came from would let it through.
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    return refuse(415, "json")
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY)
    return refuse(413, "too big")
  let body: Record<string, unknown> | null = null
  try {
    const text = await request.text()
    if (text.length > MAX_BODY) return refuse(413, "too big")
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      body = parsed
  } catch {}
  if (!body) return refuse(400, "bad request")

  const place = typeof body.place === "string" ? body.place : ""
  if (!(await realPlace(place))) return refuse(404, "no such place")
  if (!knocks(request)) return refuse(429, "slow down")
  // The honeypot: a field people never see.
  if (body.website !== undefined && body.website !== "")
    return refuse(400, "refused")
  const text = cleanText(body.text)
  if (!text) return refuse(400, "text")
  if (hasLink(text)) return refuse(400, "links")
  if (!hasStore()) return refuse(503, "no store")

  const rawTo = body.to
  if (
    rawTo !== undefined &&
    rawTo !== null &&
    !(typeof rawTo === "string" && KEY.test(rawTo))
  )
    return refuse(400, "bad reply")

  const cookie = readCookie(request)
  if (!cookie) return refuse(401, "sign in")
  const id = personId(cookie)
  try {
    const profile = await readProfile(id)
    if (!isVerified(profile)) return refuse(401, "sign in")
    const saved = usable(profile?.name)
    const name = saved ?? cleanName(body.name)
    if (!name) return refuse(400, "name")
    if (hasLink(name)) return refuse(400, "links")
    // A reply joins the thread of the comment it answers, which must still be there.
    let to: string | undefined
    if (typeof rawTo === "string") {
      const parent = await readComment(place, rawTo)
      if (!parent) return refuse(404, "no such comment")
      to = parent.to ?? parent.key
    }
    if (!posts(request) || !personAllowed(id)) return refuse(429, "slow down")
    if (!profile?.name) await writeProfile(id, { name })
    const comment = await addComment(place, { text, name, by: id, to })
    return answer({
      comment: shown(comment, id, adminIds()),
      name: profile?.name ? saved : name,
    })
  } catch (error) {
    console.error(`comment failed ${String(error).slice(0, 300)}`)
    return refuse(502, "store failed")
  }
}

export async function DELETE(request: Request) {
  if (!sameSite(request)) return refuse(403, "forbidden")
  const url = new URL(request.url)
  const place = url.searchParams.get("place") ?? ""
  const key = url.searchParams.get("id") ?? ""
  if (!KEY.test(key) || !(await realPlace(place)))
    return refuse(404, "no such comment")
  const cookie = readCookie(request)
  if (!cookie) return refuse(403, "forbidden")
  if (!knocks(request)) return refuse(429, "slow down")
  if (!hasStore()) return refuse(503, "no store")
  try {
    const comment = await readComment(place, key)
    if (!comment) return refuse(404, "no such comment")
    const me = personId(cookie)
    if (comment.by !== me && !adminIds().has(me))
      return refuse(403, "forbidden")
    await removeComment(place, comment)
    return answer({ ok: true })
  } catch (error) {
    console.error(`remove comment failed ${String(error).slice(0, 300)}`)
    return refuse(502, "store failed")
  }
}
