"use client"

import { useEffect, useMemo, useRef } from "react"
import type PostType from "@/interfaces/post"

export type MapViewport = {
  lat: number
  lng: number
  z: number
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

type Props = {
  posts: PostType[]
  onVisibleSlugsChange?: (slugs: string[]) => void
  onViewportChange?: (viewport: MapViewport) => void
  viewport?: MapViewport | null
}

export function HomeMap({
  posts,
  onVisibleSlugsChange,
  onViewportChange,
  viewport,
}: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<import("maplibre-gl").Map | null>(null)
  const postsRef = useRef(posts)
  const viewportRef = useRef(viewport)
  const visibleCallbackRef = useRef(onVisibleSlugsChange)
  const viewportCallbackRef = useRef(onViewportChange)

  useEffect(() => {
    postsRef.current = posts
  }, [posts])

  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  useEffect(() => {
    visibleCallbackRef.current = onVisibleSlugsChange
  }, [onVisibleSlugsChange])

  useEffect(() => {
    viewportCallbackRef.current = onViewportChange
  }, [onViewportChange])

  const postsKey = useMemo(
    () =>
      posts
        .map(
          (post) =>
            `${post.slug}:${post.location.lat.toFixed(6)}:${post.location.lng.toFixed(6)}`
        )
        .join("|"),
    [posts]
  )

  useEffect(() => {
    let isMounted = true
    let map: import("maplibre-gl").Map | null = null

    async function setupMap() {
      if (!mapRef.current) {
        return
      }

      const maplibreModule = await import("maplibre-gl")
      const maplibregl = maplibreModule.default ?? maplibreModule

      if (!isMounted || !mapRef.current) {
        return
      }

      const currentPosts = postsRef.current
      const currentViewport = viewportRef.current
      const initialCenter = currentViewport
        ? ([currentViewport.lng, currentViewport.lat] as [number, number])
        : ([174.76, -36.85] as [number, number])

      map = new maplibregl.Map({
        attributionControl: { compact: true },
        center: initialCenter,
        container: mapRef.current,
        keyboard: false,
        maxZoom: 17,
        minZoom: 8,
        scrollZoom: false,
        style: "https://tiles.openfreemap.org/styles/liberty",
        zoom: currentViewport?.z ?? 10,
      })
      mapInstanceRef.current = map
      const activeMap = map

      activeMap.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right"
      )

      currentPosts.forEach((post) => {
        const markerElement = document.createElement("a")
        markerElement.className = "tn-map-marker"
        markerElement.href = `/${post.slug}`
        markerElement.ariaLabel = post.name
        markerElement.dataset.testid = "home-map-marker"

        const popup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          maxWidth: "220px",
          offset: 18,
        }).setHTML(
          `
            <div style="width: 190px; font-family: sans-serif;">
              <a href="/${post.slug}" style="display: block; color: inherit; text-decoration: none;">
                <img
                  src="${post.ba_imageUrl}"
                  alt="${escapeHtml(post.name)}"
                  style="display: block; width: 100%; height: 110px; object-fit: cover; margin-bottom: 10px;"
                />
                <strong style="display: block; font-size: 14px; line-height: 1.35;">${escapeHtml(post.name)}</strong>
              </a>
              <div style="margin-top: 8px; font-size: 13px;">
                <a href="/${post.slug}" style="color: #0f172a; text-decoration: underline;">Open story</a>
              </div>
            </div>
          `
        )

        new maplibregl.Marker({ element: markerElement })
          .setLngLat([post.location.lng, post.location.lat])
          .setPopup(popup)
          .addTo(activeMap)
      })

      if (!currentViewport && currentPosts.length > 0) {
        const bounds = new maplibregl.LngLatBounds()
        currentPosts.forEach((post) => {
          bounds.extend([post.location.lng, post.location.lat])
        })
        activeMap.fitBounds(bounds, { padding: 72 })
      }

      const updateVisiblePosts = () => {
        if (!map || !visibleCallbackRef.current) {
          return
        }

        const currentBounds = map.getBounds()
        const visible = currentPosts
          .filter((post) =>
            currentBounds.contains([post.location.lng, post.location.lat])
          )
          .map((post) => post.slug)

        visibleCallbackRef.current(visible)
      }

      const updateViewport = () => {
        if (!map || !viewportCallbackRef.current) {
          return
        }

        const center = map.getCenter()
        viewportCallbackRef.current({
          lat: Number(center.lat.toFixed(6)),
          lng: Number(center.lng.toFixed(6)),
          z: Number(map.getZoom().toFixed(2)),
        })
      }

      updateVisiblePosts()
      updateViewport()
      map.on("moveend", updateVisiblePosts)
      map.on("zoomend", updateVisiblePosts)
      map.on("moveend", updateViewport)
      map.on("zoomend", updateViewport)
    }

    setupMap()

    return () => {
      isMounted = false
      mapInstanceRef.current = null
      map?.remove()
    }
  }, [postsKey])

  useEffect(() => {
    const map = mapInstanceRef.current

    if (!map || !viewport) {
      return
    }

    const center = map.getCenter()
    const currentZoom = map.getZoom()
    const latDelta = Math.abs(center.lat - viewport.lat)
    const lngDelta = Math.abs(center.lng - viewport.lng)

    if (
      latDelta <= 0.000001 &&
      lngDelta <= 0.000001 &&
      currentZoom === viewport.z
    ) {
      return
    }

    map.jumpTo({ center: [viewport.lng, viewport.lat], zoom: viewport.z })
  }, [viewport])

  return (
    <div className="overflow-hidden border border-border/70 shadow-sm">
      <div
        ref={mapRef}
        data-testid="home-map"
        className="h-[360px] w-full sm:h-[420px] lg:h-[540px]"
        aria-label="Map of story locations"
      />
    </div>
  )
}
