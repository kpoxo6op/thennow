import type { ReferenceLines } from "@/lib/rephoto/reference-lines"

export function ReferenceTrace({ guide }: { guide: ReferenceLines }) {
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
      {guide.features.map((feature) => (
        <g key={feature.name}>
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
            stroke="white"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </svg>
  )
}
