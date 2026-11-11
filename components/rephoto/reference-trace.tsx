import type { ReferenceLines } from "@/lib/rephoto/reference-lines"

export function ReferenceTrace({
  guide,
  highlighted = null,
  supported,
}: {
  guide: ReferenceLines
  highlighted?: number | null
  supported?: number[]
}) {
  return (
    <svg
      data-testid="reference-trace"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      aria-label={guide.features.map((feature) => feature.name).join(", ")}
      role="img"
      className="pointer-events-none absolute inset-0 size-full"
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {guide.features.map((feature, index) => (
        <g
          key={feature.name}
          opacity={
            supported?.length &&
            !supported.includes(index) &&
            highlighted !== index
              ? 0.35
              : 1
          }
        >
          <polyline
            points={feature.points
              .map(([x, y]) => `${x * 1000},${y * 1000}`)
              .join(" ")}
            stroke="black"
            strokeOpacity="0.8"
            strokeWidth="4"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={feature.points
              .map(([x, y]) => `${x * 1000},${y * 1000}`)
              .join(" ")}
            stroke={highlighted === index ? "#ffb45b" : "white"}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </svg>
  )
}
