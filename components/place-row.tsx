import Image from "next/image"
import Link from "next/link"

export type PlaceSummary = {
  slug: string
  name: string
  ba_imageUrl: string
  location: { lat: number; lng: number }
  area?: string
  isSample?: boolean
}

export function PlaceRow({ place }: { place: PlaceSummary }) {
  return (
    <Link
      href={`/${place.slug}`}
      className="tn-places-row group flex min-h-14 items-center gap-3 rounded-sm px-2 py-1.5 hover:bg-muted"
    >
      <span className="relative block aspect-[3/2] w-[4.5rem] shrink-0 overflow-hidden rounded-[2px] bg-muted">
        <Image
          src={place.ba_imageUrl}
          alt=""
          fill
          sizes="72px"
          className="object-cover"
        />
      </span>
      <span className="line-clamp-2 text-pretty font-serif text-[1.0625rem] leading-snug">
        {place.name}
      </span>
    </Link>
  )
}
