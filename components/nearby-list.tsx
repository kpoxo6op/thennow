import Link from "next/link"

export type Nearby = { name: string; slug: string; km: number }

function distance(km: number) {
  return km < 1 ? "Under 1 km" : `${Math.round(km)} km`
}

// Other places, nearest first. The names say what they are; no heading needed.
export function NearbyList({ items }: { items: Nearby[] }) {
  if (!items.length) return null

  return (
    <ul data-testid="nearby-list">
      {items.map((item) => (
        <li key={item.slug} className="border-b first:border-t">
          <Link
            href={`/${item.slug}`}
            className="flex items-baseline justify-between gap-4 py-3 leading-snug transition-colors hover:text-accent"
          >
            <span className="min-w-0">{item.name}</span>
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{distance(item.km)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
