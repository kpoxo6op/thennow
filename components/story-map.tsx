"use client"

import { useEffect, useRef, useState } from "react"
import type { PostLocation, PostViewpoint } from "@/interfaces/post"

import "@/styles/map.css"

interface Props {
  name: string
  location: PostLocation
  viewpoint?: PostViewpoint
}

function bearingTo(from: PostLocation, to: PostLocation) {
  const rad = Math.PI / 180
  const a = from.lat * rad
  const b = to.lat * rad
  const d = (to.lng - from.lng) * rad
  return (
    (Math.atan2(
      Math.sin(d) * Math.cos(b),
      Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b) * Math.cos(d)
    ) /
      rad +
      360) %
    360
  )
}

function direction(bearing: number) {
  return [
    "north",
    "northeast",
    "east",
    "southeast",
    "south",
    "southwest",
    "west",
    "northwest",
  ][Math.round(bearing / 45) % 8]
}

export function StoryMap({ name, location, viewpoint }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<import("maplibre-gl").Map | null>(null)
  const libraryRef = useRef<typeof import("maplibre-gl") | null>(null)
  const pickRef = useRef(false)
  const fitRef = useRef<() => void>(() => {})
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [picking, setPicking] = useState(false)
  const [chosen, setChosen] = useState<PostLocation | null>(null)
  const [geoNote, setGeoNote] = useState("")
  const spot = chosen ?? viewpoint
  const bearing = chosen
    ? Math.abs(chosen.lat - location.lat) +
        Math.abs(chosen.lng - location.lng) <
      0.00001
      ? undefined
      : bearingTo(chosen, location)
    : viewpoint?.bearing
  const context = chosen
    ? bearing === undefined
      ? "Your spot is at the place. Pick a nearby spot to see which way to face."
      : `Your spot · Face ${direction(bearing)} toward the place. Adjust your position to match the photograph.`
    : viewpoint
      ? `Suggested viewpoint · ${viewpoint.label}${bearing !== undefined ? ` · Face approximately ${direction(bearing)}.` : ""}`
      : "The dot marks the place. Pick a nearby spot to see which way to face."

  useEffect(() => {
    pickRef.current = picking
    const map = mapRef.current
    if (!map) return
    if (picking) {
      map.keyboard.enable()
      map.keyboard.disableRotation()
    } else map.keyboard.disable()
    map.getCanvas().tabIndex = picking ? 0 : -1
    map.getCanvas().style.cursor = picking ? "crosshair" : ""
  }, [picking, ready])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let mounted = true
    let map: import("maplibre-gl").Map | null = null
    let cleanupTouch = () => {}
    async function setup() {
      const mapLibrary = await import("maplibre-gl")
      if (!mounted) return
      libraryRef.current = mapLibrary
      const maplibregl = mapLibrary
      map = new maplibregl.Map({
        container: container!,
        center: [location.lng, location.lat],
        zoom: 17,
        minZoom: 8,
        maxZoom: 19,
        attributionControl: { compact: true },
        style: "https://tiles.openfreemap.org/styles/liberty",
        scrollZoom: false,
        keyboard: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        doubleClickZoom: false,
      })
      mapRef.current = map
      const activeMap = map
      let loaded = false
      activeMap.on("load", () => {
        loaded = true
        if (!mounted) return
        setFailed(false)
        setReady(true)
        // Streets and building footprints help positioning; shop badges obscure the guide.
        for (const layer of activeMap.getStyle().layers) {
          if (
            layer.type === "symbol" &&
            "source-layer" in layer &&
            layer["source-layer"] === "poi"
          )
            activeMap.setLayoutProperty(layer.id, "visibility", "none")
        }
        const attribution = container!.querySelector(".maplibregl-ctrl-attrib")
        attribution?.classList.remove("maplibregl-compact-show")
        attribution?.removeAttribute("open")
      })
      activeMap.on("error", () => {
        if (!loaded && mounted) setFailed(true)
      })
      activeMap.on("click", (event) => {
        if (!pickRef.current) return
        setChosen({ lat: event.lngLat.lat, lng: event.lngLat.lng })
        pickRef.current = false
        setPicking(false)
      })
      activeMap.touchZoomRotate.enable({ around: "center" })
      activeMap.touchZoomRotate.disableRotation()
      const canvasArea = activeMap.getCanvasContainer()
      const leaveToPage = (event: TouchEvent) => {
        if (
          event.touches.length === 1 &&
          canvasArea.contains(event.target as Node)
        )
          event.stopPropagation()
      }
      container!.addEventListener("touchstart", leaveToPage, {
        capture: true,
        passive: true,
      })
      container!.addEventListener("touchmove", leaveToPage, {
        capture: true,
        passive: true,
      })
      cleanupTouch = () => {
        container!.removeEventListener("touchstart", leaveToPage, true)
        container!.removeEventListener("touchmove", leaveToPage, true)
      }
      activeMap.getCanvas().tabIndex = -1
      activeMap.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right"
      )
      const geolocate = new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showAccuracyCircle: true,
        fitBoundsOptions: { maxZoom: 17 },
      })
      geolocate.on("geolocate", () =>
        setGeoNote("Your location is shown with its accuracy circle.")
      )
      geolocate.on("error", () =>
        setGeoNote(
          "Couldn’t find your location. You can still pick a spot or open directions."
        )
      )
      activeMap.addControl(geolocate, "top-right")
      const pin = document.createElement("div")
      pin.className =
        "tn-map-marker tn-map-marker--point is-active tn-story-pin"
      pin.dataset.testid = "story-map-pin"
      pin.append(document.createElement("span"))
      const label = document.createElement("div")
      label.className = "tn-story-place-label"
      label.textContent = name.split(",")[0]
      label.setAttribute("aria-hidden", "true")
      pin.append(label)
      new maplibregl.Marker({ element: pin })
        .setLngLat([location.lng, location.lat])
        .addTo(activeMap)
      pin.setAttribute("role", "img")
      pin.setAttribute("aria-label", name)
      activeMap.on("resize", () => fitRef.current())
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        setup().catch(() => {
          if (mounted) setFailed(true)
        })
      },
      { rootMargin: "400px 0px" }
    )
    observer.observe(container)
    return () => {
      mounted = false
      observer.disconnect()
      cleanupTouch()
      map?.remove()
      mapRef.current = null
    }
  }, [location.lat, location.lng, name])

  useEffect(() => {
    const map = mapRef.current
    const mapLibrary = libraryRef.current
    if (!ready || !map || !mapLibrary) return
    const maplibregl = mapLibrary
    let marker: import("maplibre-gl").Marker | undefined
    if (spot) {
      const pin = document.createElement("div")
      pin.className = "tn-viewpoint"
      pin.dataset.testid = "story-map-viewpoint"
      pin.setAttribute("role", "img")
      pin.setAttribute(
        "aria-label",
        chosen ? "Your chosen spot" : "Suggested viewpoint"
      )
      if (bearing !== undefined) {
        const cone = document.createElement("span")
        cone.className = "tn-viewpoint-cone"
        cone.style.transform = `rotate(${bearing}deg)`
        pin.append(cone)
      }
      const camera = document.createElement("span")
      camera.className = "tn-viewpoint-camera"
      camera.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6h4l2-2h4l2 2h4v14H4z"/><circle cx="12" cy="13" r="4"/></svg>'
      pin.append(camera)
      marker = new maplibregl.Marker({ element: pin })
        .setLngLat([spot.lng, spot.lat])
        .addTo(map)
    }
    fitRef.current = () => {
      if (spot) {
        const bounds = new maplibregl.LngLatBounds(
          [location.lng, location.lat],
          [location.lng, location.lat]
        )
        bounds.extend([spot.lng, spot.lat])
        map.fitBounds(bounds, {
          padding: { top: 65, bottom: 55, left: 55, right: 75 },
          maxZoom: 17,
          duration: 0,
        })
      } else
        map.jumpTo({
          center: [location.lng, location.lat],
          zoom: 17,
          bearing: 0,
          pitch: 0,
        })
    }
    fitRef.current()
    return () => {
      marker?.remove()
      fitRef.current = () => {}
    }
  }, [ready, spot, bearing, chosen, location.lat, location.lng])

  const destination = spot ?? location
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=walking`
  const actionClass =
    "inline-flex min-h-11 items-center py-2 text-sm underline underline-offset-4 disabled:opacity-40"

  return (
    <div className="mt-10 max-w-3xl">
      <div className="tn-map tn-story-map relative aspect-video max-h-[60svh] min-h-56 w-full overflow-hidden bg-muted">
        <div
          ref={containerRef}
          data-testid="story-map"
          role="region"
          aria-label={`Map showing where ${name} is`}
          className="size-full"
        />
        {picking && !failed ? (
          <span aria-hidden="true" className="tn-map-crosshair">
            +
          </span>
        ) : null}
        {failed ? (
          <p
            data-testid="story-map-failure"
            className="absolute inset-0 z-10 flex items-center justify-center bg-muted px-4 text-center text-[15px] text-muted-foreground"
          >
            The map didn&apos;t load. This place is at {location.lat.toFixed(5)}
            , {location.lng.toFixed(5)}. Walking directions are still available
            below.
          </p>
        ) : null}
      </div>
      <p
        data-testid="story-map-context"
        role="status"
        className="mt-3 text-sm leading-relaxed text-muted-foreground"
      >
        {context}
      </p>
      {geoNote ? (
        <p role="status" className="mt-1 text-sm text-muted-foreground">
          {geoNote}
        </p>
      ) : null}
      {picking ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Tap where you plan to stand. With a keyboard, use the map’s arrow
          keys, then choose its centre.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-5">
        {picking ? (
          <>
            <button
              type="button"
              className={actionClass}
              onClick={() => {
                const center = mapRef.current?.getCenter()
                if (center) setChosen({ lat: center.lat, lng: center.lng })
                setPicking(false)
              }}
            >
              Use map centre
            </button>
            <button
              type="button"
              className={actionClass}
              onClick={() => setPicking(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            data-testid="story-map-pick"
            className={actionClass}
            disabled={!ready || failed}
            onClick={() => {
              setPicking(true)
              requestAnimationFrame(() =>
                mapRef.current?.getCanvas().focus({ preventScroll: true })
              )
            }}
          >
            {chosen ? "Change your spot" : "Choose your spot"}
          </button>
        )}
        <a
          data-testid="story-map-directions"
          className={actionClass}
          href={directions}
          target="_blank"
          rel="noreferrer"
          aria-label={`Walking directions to ${spot ? "the spot" : name}`}
        >
          Walking directions
        </a>
        <button
          type="button"
          className={actionClass}
          disabled={!ready || failed}
          onClick={() => {
            setChosen(null)
            setPicking(false)
            setGeoNote("")
            if (!chosen) fitRef.current()
          }}
        >
          Reset map
        </button>
      </div>
    </div>
  )
}
