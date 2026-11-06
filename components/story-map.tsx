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

      const touchFirst = window.matchMedia("(pointer: coarse)").matches
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
          // One finger belongs to the page; on a phone two fingers still zoom.
          dragPan: !touchFirst,
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

      activeMap.touchZoomRotate.disableRotation()
      activeMap.getCanvas().removeAttribute("tabindex")
      activeMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")

      const pin = document.createElement("div")
      pin.className = "tn-map-marker tn-map-marker--point is-active tn-story-pin"
      pin.dataset.testid = "story-map-pin"
      pin.append(document.createElement("span"))
      new maplibregl.Marker({ element: pin }).setLngLat(center).addTo(activeMap)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          setup()
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
    <section className="mt-8 border-t pt-4 md:mt-10">
      <h2 className="tn-reading text-[1.75rem] leading-none text-muted-foreground">Where</h2>
      <div className="tn-map tn-story-map relative mt-4 aspect-[4/3] max-h-[60svh] w-full overflow-hidden bg-muted md:aspect-[3/1]">
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
    </section>
  )
}
