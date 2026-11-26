import type { ReferenceLines } from "@/lib/rephoto/reference-lines"

const frameCorners = {
  "upper-left": "M 1 44 V 1 H 42",
  "upper-right": "M 958 1 H 999 V 44",
  "lower-right": "M 999 956 V 999 H 958",
  "lower-left": "M 42 999 H 1 V 956",
} as const

export function ReferenceTrace({
  guide,
  highlighted = null,
  confirmed = [],
  off = [],
  near = [],
  possible = [],
  shifts = [],
}: {
  guide: ReferenceLines
  highlighted?: number | null
  // Lines found sitting on their edge in the live picture.
  confirmed?: number[]
  // Lines found off their edge in a taken shot.
  off?: number[]
  near?: number[]
  possible?: number[]
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
      <g aria-label="Archive framing" strokeWidth="1.5">
        {guide.framing?.map((line) => {
          const points = line.points
            .map(([x, y]) => `${x * 1000},${y * 1000}`)
            .join(" ")
          return (
            <g key={line.name} aria-label={line.name} strokeDasharray="6 3">
              <polyline
                points={points}
                stroke="black"
                strokeOpacity=".8"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                points={points}
                stroke="white"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )
        })}
        {Object.entries(frameCorners).map(([corner, path]) => {
          const index = guide.features.findIndex((f) => f.corner === corner)
          if (index < 0) return null
          const state = off.includes(index)
            ? "off"
            : confirmed.includes(index)
              ? "on"
              : "unknown"
          return (
            <g
              key={corner}
              aria-label={corner + " · " + guide.features[index].name}
              data-corner={corner}
              data-state={state}
            >
              <path
                d={path}
                stroke="black"
                strokeWidth="4"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={path}
                stroke={
                  state === "off"
                    ? "#fbbf24"
                    : state === "on"
                      ? "#a3e635"
                      : "white"
                }
                strokeWidth={state === "unknown" ? 1.5 : 3}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )
        })}
      </g>
      {guide.features.map((feature, index) => (
        <g
          key={feature.name}
          aria-label={feature.name}
          data-state={
            confirmed.includes(index)
              ? "on"
              : off.includes(index)
                ? "off"
                : near.includes(index)
                  ? "near"
                  : possible.includes(index)
                    ? "possible"
                    : "unknown"
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
            stroke={
              off.includes(index)
                ? "#fbbf24"
                : highlighted === index
                  ? "#ffb45b"
                  : confirmed.includes(index)
                    ? "#a3e635"
                    : near.includes(index) || possible.includes(index)
                      ? "#7dd3fc"
                      : "white"
            }
            strokeDasharray={possible.includes(index) ? "3 4" : undefined}
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
          stroke={possible.includes(index) ? "#7dd3fc" : "#fbbf24"}
          strokeOpacity="0.85"
          strokeWidth="2"
          strokeDasharray="6 5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}
