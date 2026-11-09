// How far the phone is turned about the lens axis, from gravity, in radians: positive when the
// phone's top leans clockwise as the person sees the screen. Old photographs were nearly always
// taken level, so this is the one correction that needs no guessing.

// Gravity in the device's own axes, as the browser reports it with gravity included.
export function tiltFromGravity(
  x: number,
  y: number,
  screenAngleDegrees: number
) {
  const a = (screenAngleDegrees * Math.PI) / 180
  // Into the axes of the screen as it is currently shown, which is the device's turned by -a.
  const sx = x * Math.cos(a) - y * Math.sin(a)
  const sy = x * Math.sin(a) + y * Math.cos(a)
  let angle = Math.atan2(-sx, sy)
  // Android reports gravity pointing up and older iPhones pointing down, a half turn apart;
  // folding to within a quarter turn either side makes both read the same small lean.
  while (angle > Math.PI / 2) angle -= Math.PI
  while (angle <= -Math.PI / 2) angle += Math.PI
  return angle
}

export function screenAngle() {
  if (
    typeof screen !== "undefined" &&
    screen.orientation &&
    typeof screen.orientation.angle === "number"
  ) {
    return screen.orientation.angle
  }
  const legacy = (globalThis as unknown as { orientation?: number }).orientation
  return typeof legacy === "number" ? legacy : 0
}
