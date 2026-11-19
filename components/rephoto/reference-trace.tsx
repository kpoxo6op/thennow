import type { ReferenceLines } from "@/lib/rephoto/reference-lines"

export function ReferenceTrace({
  guide,
  highlighted = null,
  confirmed = [],
  off = [],
  shifts = [],
}: {
  guide: ReferenceLines
  highlighted?: number | null
  // Lines found sitting on their edge in the live picture.
  confirmed?: number[]
  // Lines found off their edge in a taken shot.
  off?: number[]
  // Where an off line's edge really is now (fractions of the old photo): drawn as a dashed copy.
  shifts?: { index: number; dx: number; dy: number }[]
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
            stroke={
              off.includes(index)
                ? "#fbbf24"
                : highlighted === index
                  ? "#ffb45b"
                  : confirmed.includes(index)
                    ? "#a3e635"
                    : "white"
            }
            strokeWidth={
              off.includes(index)
                ? "3"
                : confirmed.includes(index)
                  ? "2.5"
                  : "1.5"
            }
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
      {shifts.map(({ index, dx, dy }) => (
        <polyline
          key={`shift-${index}`}
          data-testid="line-shift"
          className="transition-transform duration-100 ease-linear"
          style={{ transform: `translate(${dx * 1000}px, ${dy * 1000}px)` }}
          points={guide.features[index].points
            .map(([x, y]) => `${x * 1000},${y * 1000}`)
            .join(" ")}
          stroke="#fbbf24"
          strokeOpacity="0.85"
          strokeWidth="2"
          strokeDasharray="6 5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}
