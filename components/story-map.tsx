"use client"

import { useEffect, useRef, useState } from "react"
import type { PostLocation } from "@/interfaces/post"

// A narrow frame steps back a level, so the town still gets named around the pin.
const STORY_ZOOM = 13
const NARROW_STORY_ZOOM = 12

interface Props {
  name: string
  location: PostLocation
}

// Where this one story is. It is built only as the reader nears it, and it leaves the page's
// scrolling alone: a finger or a wheel passing over it keeps moving the page.
export function StoryMap({ name, location }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    let isMounted = true
    let map: import("maplibre-gl").Map | null = null

    async function setup() {
      const maplibreModule = await import("maplibre-gl")
      const maplibregl = maplibreModule.default ?? maplibreModule

      if (!isMounted || !container) {
        return
      }

      const center: [number, number] = [location.lng, location.lat]

      try {
        map = new maplibregl.Map({
          container,
          center,
          zoom: container.clientWidth < 640 ? NARROW_STORY_ZOOM : STORY_ZOOM,
          minZoom: 8,
          maxZoom: 16,
          attributionControl: { compact: true },
          style: "https://tiles.openfreemap.org/styles/liberty",
          scrollZoom: false,
          keyboard: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          doubleClickZoom: false,
        })
      } catch {
        setFailed(true)
        return
      }

      const activeMap = map
      let loaded = false

      activeMap.on("load", () => {
        loaded = true
        const attribution = container.querySelector(".maplibregl-ctrl-attrib")
        attribution?.classList.remove("maplibregl-compact-show")
        attribution?.removeAttribute("open")
      })
      activeMap.on("error", () => {
        if (!loaded) {
          setFailed(true)
        }
      })

      // Two fingers zoom, always around the pin, so it can't be lost.
      activeMap.touchZoomRotate.enable({ around: "center" })
      activeMap.touchZoomRotate.disableRotation()

      // One finger belongs to the page, on any touch screen; the map never hears of it.
      const canvasArea = activeMap.getCanvasContainer()
      const leaveToPage = (event: TouchEvent) => {
        if (event.touches.length === 1 && canvasArea.contains(event.target as Node)) {
          event.stopPropagation()
        }
      }
      container.addEventListener("touchstart", leaveToPage, { capture: true, passive: true })
      container.addEventListener("touchmove", leaveToPage, { capture: true, passive: true })
      activeMap.getCanvas().removeAttribute("tabindex")
      activeMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")

      const pin = document.createElement("div")
      pin.className = "tn-map-marker tn-map-marker--point is-active tn-story-pin"
      pin.dataset.testid = "story-map-pin"
      pin.append(document.createElement("span"))
      new maplibregl.Marker({ element: pin }).setLngLat(center).addTo(activeMap)
      // The region's own label says what it shows; the pin is not a control.
      pin.removeAttribute("role")
      pin.removeAttribute("aria-label")
      pin.setAttribute("aria-hidden", "true")
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          // The map's own code may not arrive (a weak signal, a page older than the last release).
          setup().catch(() => {
            if (isMounted) setFailed(true)
          })
        }
      },
      { rootMargin: "400px 0px" }
    )

    observer.observe(container)

    return () => {
      isMounted = false
      observer.disconnect()
      map?.remove()
    }
  }, [location.lat, location.lng])

  const ns = location.lat < 0 ? "S" : "N"
  const ew = location.lng < 0 ? "W" : "E"

  return (
    <div className="mt-10">
      <div className="tn-map tn-story-map relative aspect-video max-h-[60svh] min-h-56 w-full max-w-3xl overflow-hidden bg-muted">
        <div
          ref={containerRef}
          data-testid="story-map"
          role="region"
          aria-label={`Map showing where ${name} is`}
          className="size-full"
        />
        {failed ? (
          <p
            data-testid="story-map-failure"
            className="absolute inset-0 z-10 flex items-center justify-center bg-muted px-4 text-center text-[15px] text-muted-foreground"
          >
            The map didn&apos;t load. This place is at {Math.abs(location.lat).toFixed(4)}° {ns},{" "}
            {Math.abs(location.lng).toFixed(4)}° {ew}.
          </p>
        ) : null}
      </div>
    </div>
  )
}
