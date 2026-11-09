import { Metadata } from "next"
import { cookies } from "next/headers"
import Link from "next/link"
import { list } from "@vercel/blob"

import { fetchPending, fetchPosts } from "@/lib/api"
import { COOKIE, personId, photosPrefix, readProfile } from "@/lib/people"
import { MeName } from "@/components/me-name"
import { MeRenew } from "@/components/me-renew"

// Your photos: where someone signs up with a name, at any time, and sees the photos they have
// sent. The browser's cookie is the only key, so the page is never cached or shared.

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Your photos",
  robots: { index: false },
  referrer: "no-referrer",
}

type Photo = { place: string; key: string; name: string; sentAt: Date }

async function photosOf(id: string, names: Map<string, string>) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return []
  const photos: Photo[] = []
  let cursor: string | undefined
  do {
    const page = await list({ prefix: photosPrefix(id), cursor, limit: 1000 })
    for (const blob of page.blobs) {
      const [place, file] = blob.pathname.slice(photosPrefix(id).length).split("/")
      const key = file?.replace(/\.jpg$/, "")
      if (!place || !key) continue
      photos.push({ place, key, name: names.get(place) ?? place, sentAt: blob.uploadedAt })
    }
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  return photos.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
}

const day = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Pacific/Auckland",
})

export default async function MePage() {
  const cookie = (await cookies()).get(COOKIE)?.value
  const valid = cookie && /^[A-Za-z0-9_-]{32}$/.test(cookie)
  const places = [...(await fetchPosts()), ...(await fetchPending())]
  const names = new Map(places.map((place) => [place.slug, place.name]))
  let photos: Photo[] = []
  let name: string | null = null
  let passkey = false
  let failed = false
  if (valid) {
    const id = personId(cookie)
    try {
      const [sent, profile] = await Promise.all([photosOf(id, names), readProfile(id)])
      photos = sent
      name = profile?.name ?? null
      passkey = !!profile?.passkey
    } catch (error) {
      console.error(`me failed ${String(error).slice(0, 300)}`)
      failed = true
    }
  }

  return (
    <article data-testid="me" className="px-4 pb-16 pt-8 md:pb-24 md:pt-14">
      {valid && <MeRenew />}
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        <h1 className="font-serif text-6xl leading-none md:text-7xl">Your photos</h1>
        <div className="max-w-2xl space-y-5">
          {failed ? (
            <p className="text-lg leading-relaxed">
              Your photos can’t be shown just now. Please try again in a minute.
            </p>
          ) : (
            <>
              {photos.length ? (
                <p className="text-lg leading-relaxed">
                  We look at every photo before it goes on the site.
                </p>
              ) : (
                <p data-testid="me-empty" className="text-lg leading-relaxed">
                  Photos you send from the camera will appear here.{" "}
                  <Link href="/places" className="underline underline-offset-4">
                    Find a place to photograph
                  </Link>
                  .
                </p>
              )}
              <MeName name={name} passkey={passkey} />
            </>
          )}
        </div>
      </div>

      {photos.length > 0 && (
        <ul data-testid="me-photos" className="mt-10 grid grid-cols-2 gap-x-4 gap-y-6 md:mt-14 md:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <li key={`${photo.place}/${photo.key}`} data-testid="me-photo" className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/me/photo?place=${photo.place}&key=${photo.key}`}
                alt={`Your photo of ${photo.name}`}
                loading="lazy"
                className="aspect-[4/3] w-full rounded-sm bg-muted object-cover"
              />
              <div>
                <Link href={`/${photo.place}`} className="text-base font-medium leading-snug underline-offset-4 hover:underline">
                  {photo.name}
                </Link>
                <p className="text-[15px] text-muted-foreground">{day.format(photo.sentAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-14 max-w-2xl border-t pt-6 text-[15px] leading-relaxed text-muted-foreground lg:ml-[calc(50%+1.25rem)]">
        Signing up saves a passkey, so you can sign in on another device. No email, no password. Your name is kept only to credit your photos.{" "}
        <Link href="/about#your-photos" className="underline underline-offset-4">
          Privacy
        </Link>
      </p>
    </article>
  )
}
