import { link, linkedCookie, originOf, takeLanded } from "@/lib/auth"
import { moveComments } from "@/lib/comments"
import {
  cookieHeader,
  isSecure,
  isVerified,
  movePhotos,
  newCookie,
  personId,
  readCookie,
  readProfile,
  writeProfile,
} from "@/lib/people"
import { hasStore } from "@/lib/store"

// The last step of signing in with another account: this browser gets the person's cookie.
//
// - An account already linked always signs in as the person it is linked to. A browser that had
//   only sent photos or written comments, without signing in, brings them along. A browser
//   signed in as someone else is simply switched: two people are never merged.
// - An account not yet linked joins this browser's own photos and comments, unless the browser is
//   signed in as someone already: then it is a new person, and the browser switches to them.
// The name the account gives is used only when the person has none yet.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(request: Request) {
  const origin = originOf(request)
  const { landed, clear } = takeLanded(request)
  const go = (path: string, cookie?: string) => {
    const headers = new Headers({
      location: `${origin}${path}`,
      "cache-control": "private, no-store",
    })
    headers.append("set-cookie", clear)
    if (cookie)
      headers.append("set-cookie", cookieHeader(cookie, isSecure(request)))
    return new Response(null, { status: 303, headers })
  }
  if (!landed) return go("/me#signin-failed")
  if (!hasStore()) return go(`${landed.b}#signin-failed`)

  try {
    const before = readCookie(request)
    let cookie = await linkedCookie(landed.p, landed.sub)
    if (cookie) {
      if (before && before !== cookie) {
        const was = await readProfile(personId(before))
        if (!isVerified(was)) {
          await movePhotos(personId(before), personId(cookie))
          await moveComments(personId(before), personId(cookie))
        }
      }
    } else {
      const was = before ? await readProfile(personId(before)) : null
      cookie = before && !isVerified(was) ? before : newCookie()
      try {
        await link(landed.p, landed.sub, cookie)
      } catch {
        // Linked a moment ago by another tab: that link wins. A link that exists but can't be
        // opened (its key changed) fails here rather than being replaced by a new person.
        const won = await linkedCookie(landed.p, landed.sub)
        if (!won) throw new Error("link failed")
        cookie = won
      }
    }
    const id = personId(cookie)
    const profile = await readProfile(id)
    await writeProfile(id, {
      via: landed.p,
      ...(!profile?.name && landed.name ? { name: landed.name } : {}),
    })
    return go(landed.b, cookie)
  } catch (error) {
    console.error(`sign in done failed ${String(error).slice(0, 300)}`)
    return go(`${landed.b}#signin-failed`)
  }
}
