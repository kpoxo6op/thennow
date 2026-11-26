import { useCallback, useEffect, useRef, useState, type RefObject } from "react"

type ZoomRange = { min: number; max: number; step?: number }
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v))

function trackZoom(track: MediaStreamTrack) {
  return (
    (track.getSettings() as MediaTrackSettings & { zoom?: number }).zoom ?? 1
  )
}

// Use the lens range advertised for this track. A centred sensor crop also works
// on browsers without zoom constraints. Its widest setting uses the entire frame.
export function useCameraZoom(
  stage: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  frameFill: number
) {
  const current = useRef<{
    track: MediaStreamTrack
    range?: ZoomRange
    constraints: MediaTrackConstraints
    wanted: number
    applying: boolean
  } | null>(null)
  const chosen = useRef<number | null>(null)
  const [zoom, setZoom] = useState({
    value: 1,
    digital: 1,
    native: 1,
    min: frameFill,
    max: 4,
  })
  const change = useCallback(
    async (value: number) => {
      const session = current.current
      if (!session || !Number.isFinite(value)) return
      const native = trackZoom(session.track)
      session.wanted = clamp(
        value,
        (session.range?.min ?? native) * frameFill,
        Math.max(4, session.range?.max ?? native)
      )
      chosen.current = session.wanted
      if (session.applying) return
      session.applying = true
      try {
        while (
          current.current === session &&
          session.track.readyState === "live"
        ) {
          const requested = session.wanted
          let native = trackZoom(session.track)
          const range = session.range
          if (range) {
            const target = clamp(requested, range.min, range.max)
            const level = range.step
              ? clamp(
                  range.min +
                    Math.floor((target - range.min) / range.step + 1e-8) *
                      range.step,
                  range.min,
                  range.max
                )
              : target
            if (Math.abs(native - level) > 0.0001) {
              try {
                await session.track.applyConstraints({
                  ...session.constraints,
                  advanced: [
                    ...(session.constraints.advanced ?? []),
                    { zoom: level } as MediaTrackConstraintSet,
                  ],
                })
              } catch {
                // Some browsers advertise lens zoom but deny camera controls.
                session.range = undefined
              }
              if (current.current !== session) return
              native = trackZoom(session.track)
              if (
                Math.abs(native - level) >
                Math.max(0.001, (range.step ?? 0) / 2)
              )
                session.range = undefined
            }
          }
          const min = (session.range?.min ?? native) * frameFill
          const max = Math.max(4, session.range?.max ?? native)
          const actual = clamp(
            requested,
            Math.max(min, native * frameFill),
            max
          )
          setZoom({ value: actual, native, digital: actual / native, min, max })
          if (requested === session.wanted) {
            chosen.current = actual
            session.wanted = actual
            break
          }
        }
      } finally {
        session.applying = false
      }
    },
    [frameFill]
  )

  const attach = useCallback(
    (track: MediaStreamTrack | null) => {
      current.current = null
      if (!track) return
      const native = trackZoom(track)
      const caps = track.getCapabilities?.() as
        | (MediaTrackCapabilities & { zoom?: ZoomRange })
        | undefined
      const range =
        caps?.zoom && caps.zoom.min > 0 && caps.zoom.max >= caps.zoom.min
          ? caps.zoom
          : undefined
      current.current = {
        track,
        range,
        constraints: track.getConstraints(),
        wanted: native,
        applying: false,
      }
      setZoom({
        value: native,
        digital: 1,
        native,
        min: (range?.min ?? native) * frameFill,
        max: Math.max(4, range?.max ?? native),
      })
      if (chosen.current != null) void change(chosen.current)
    },
    [frameFill, change]
  )
  useEffect(() => {
    const el = stage.current
    if (!el || !enabled) return
    let initial: { distance: number; zoom: number } | undefined
    const distance = (e: TouchEvent) =>
      Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      )
    const start = (e: TouchEvent) => {
      initial = undefined
      if (e.touches.length !== 2 || !current.current) return
      if (
        Array.from(e.touches).some(
          (t) => t.target instanceof Element && t.target.closest("button, a")
        )
      )
        return
      e.preventDefault()
      const span = distance(e)
      if (span > 0) initial = { distance: span, zoom: current.current.wanted }
    }
    const move = (e: TouchEvent) => {
      if (!initial || e.touches.length !== 2) return
      e.preventDefault()
      void change((initial.zoom * distance(e)) / initial.distance)
    }
    const end = () => {
      initial = undefined
    }
    el.addEventListener("touchstart", start, { passive: false })
    el.addEventListener("touchmove", move, { passive: false })
    el.addEventListener("touchend", end)
    el.addEventListener("touchcancel", end)
    return () => {
      el.removeEventListener("touchstart", start)
      el.removeEventListener("touchmove", move)
      el.removeEventListener("touchend", end)
      el.removeEventListener("touchcancel", end)
    }
  }, [stage, enabled, change])
  return { zoom, attach, change }
}
