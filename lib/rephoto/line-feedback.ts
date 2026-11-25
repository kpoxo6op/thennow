import type { LineCheck, LineVerdict } from "./line-check"
import type { ReferenceLines } from "./reference-lines"

// Two well-separated local matches can support edge feedback while the scene
// matcher loads. They never certify the viewpoint or the identity of the scene.
export function corroborated(
  check: LineCheck,
  guide: ReferenceLines,
  aspect: number
) {
  const seen = check.lines.filter(
    (line) => line.distinctive && line.state !== "unknown"
  )
  const centers = guide.features.map((f) =>
    f.points.reduce(
      ([x, y], [u, v]) => [x + u / f.points.length, y + v / f.points.length],
      [0, 0]
    )
  )
  return seen.some((a, i) =>
    seen.slice(i + 1).some((b) => {
      if (
        Math.hypot(
          centers[a.index][0] - centers[b.index][0],
          centers[a.index][1] - centers[b.index][1]
        ) < 0.18
      )
        return false
      if (a.state === "on" && b.state === "on") return true
      // Two independently distinctive, strongly supported landmarks can move
      // in opposite directions with parallax. Each keeps its own correction.
      if (Math.min(a.support, b.support) >= 0.85) return true
      if (!a.shift || !b.shift) return false
      return (
        Math.hypot(
          a.shift[0] - b.shift[0],
          (a.shift[1] - b.shift[1]) * aspect
        ) < 0.035
      )
    })
  )
}

export function focusLine(check: LineCheck, guide: ReferenceLines) {
  // Give the foreground reference priority when multiple edges need work.
  return (
    check.lines.find(
      (l) =>
        l.state === "off" &&
        guide.features[l.index].name === guide.foreground &&
        l.shift
    ) ??
    check.lines.find((l) => l.votes && l.state === "off" && l.shift) ??
    check.lines.find((l) => l.state === "off" && l.shift) ??
    check.lines.find((l) => l.votes && l.state === "off")
  )
}

// Screen-space motion describes the visible gap without guessing whether to
// turn the phone, change height, or walk to a different spot.
export function lineInstruction(
  guide: ReferenceLines,
  aspect: number,
  line?: LineVerdict
) {
  if (!line) return "Find " + guide.features[0].name
  const name = guide.features[line.index].name
  if (!line.shift) return "Match " + name
  const [dx, y] = line.shift
  const dy = y * aspect
  const arrow =
    Math.abs(dx) > Math.abs(dy) * 1.6
      ? dx > 0
        ? "←"
        : "→"
      : Math.abs(dy) > Math.abs(dx) * 1.6
        ? dy > 0
          ? "↑"
          : "↓"
        : dx > 0
          ? dy > 0
            ? "↖"
            : "↙"
          : dy > 0
            ? "↗"
            : "↘"
  return name + " · bring edge " + arrow
}

// Show a single candidate as provisional while the other landmarks are out of view.
// A new camera frame must reproduce both the edge and the direction of its gap.
export function consistentEdge(a: LineVerdict, b?: LineVerdict) {
  if (
    !a.distinctive ||
    !b?.distinctive ||
    a.state === "unknown" ||
    b.state !== a.state
  )
    return false
  if (a.state === "on") return true
  if (!a.shift || !b.shift) return false
  const [x, y] = a.shift,
    [u, v] = b.shift
  return (
    x * u + y * v > 0.65 * Math.hypot(x, y) * Math.hypot(u, v) &&
    Math.hypot(x - u, y - v) < 0.04
  )
}
