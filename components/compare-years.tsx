// Each year stays beside the line, and inside the frame when the line nears an edge.
export function CompareYears({
  position,
  thenYear,
  nowYear,
}: {
  position: number
  thenYear?: string
  nowYear?: string
}) {
  const pill =
    "tn-year absolute top-3 flex h-7 items-center justify-center rounded-md bg-black/70 font-serif text-[1.0625rem] leading-none text-white md:top-4 md:h-8 md:text-xl"

  return (
    <>
      {thenYear ? (
        <span className={pill} style={{ left: `max(0.25rem, calc(${position}% - 0.5rem - var(--pill)))` }}>
          {thenYear}
        </span>
      ) : null}
      {nowYear ? (
        <span className={pill} style={{ left: `min(calc(100% - 0.25rem - var(--pill)), calc(${position}% + 0.5rem))` }}>
          {nowYear}
        </span>
      ) : null}
    </>
  )
}
