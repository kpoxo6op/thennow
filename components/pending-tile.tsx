import Image from "next/image"
import Link from "next/link"
import type { PendingSummary } from "@/interfaces/post"

interface Props {
  place: PendingSummary
  sizes: string
}

// One photograph, whole and unsplit: the absence of the line is the difference from a finished story.
export function PendingTile({ place, sizes }: Props) {
  return (
    <Link href={`/${place.slug}`} prefetch={false} data-testid="pending-card" className="group block w-full">
      <span className="relative block aspect-[3/2] w-full overflow-hidden bg-muted">
        <Image src={place.b_imageUrl} alt="" fill sizes={sizes} className="object-cover opacity-90 transition-opacity group-hover:opacity-100" />
      </span>
      <span className="mt-2 block text-[15px] font-medium leading-snug underline-offset-4 group-hover:underline md:text-lg">
        {place.name}
      </span>
    </Link>
  )
}
