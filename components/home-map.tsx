"use client"

import { useEffect, useMemo, useRef } from "react"
import type PostType from "@/interfaces/post"

import { getRuntimeBasemapConfig } from "@/lib/map-basemaps"

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
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null)
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
    let map: import("leaflet").Map | null = null

    async function setupMap() {
      if (!mapRef.current) {
        return
      }

      const leafletModule = await import("leaflet")
      const L = leafletModule.default ?? leafletModule
      ;(
        globalThis as typeof globalThis & {
          L?: typeof L
          window?: Window & typeof globalThis & { L?: typeof L }
        }
      ).L = L

      if (typeof window !== "undefined") {
        ;(window as Window & typeof globalThis & { L?: typeof L }).L = L
      }

      await import("leaflet.markercluster/dist/leaflet.markercluster-src.js")

      if (!isMounted || !mapRef.current) {
        return
      }

      const currentPosts = postsRef.current
      const currentViewport = viewportRef.current
      const currentBasemap = getRuntimeBasemapConfig(window.location.hostname)

      map = L.map(mapRef.current, {
        attributionControl: false,
        keyboard: false,
        scrollWheelZoom: false,
      })
      mapInstanceRef.current = map

      L.tileLayer(currentBasemap.tileUrl, {
        attribution: currentBasemap.attribution,
        maxZoom: 19,
      }).addTo(map)

      const bounds = L.latLngBounds(
        currentPosts.map(
          (post) => [post.location.lat, post.location.lng] as [number, number]
        )
      )

      const globalLeaflet = (
        globalThis as typeof globalThis & {
          L?: typeof L & {
            markerClusterGroup?: (options?: object) => {
              addLayer: (layer: import("leaflet").Layer) => void
            } & import("leaflet").Layer
          }
        }
      ).L

      const clusterFactory = globalLeaflet?.markerClusterGroup
      const clusterGroup = clusterFactory?.({
        showCoverageOnHover: false,
        maxClusterRadius: 40,
      })

      currentPosts.forEach((post) => {
        const marker = L.circleMarker([post.location.lat, post.location.lng], {
          radius: 7,
          color: "#ffffff",
          weight: 3,
          fillColor: "#0f172a",
          fillOpacity: 1,
        })

        marker.bindPopup(
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
          `,
          { maxWidth: 220, minWidth: 190 }
        )

        if (clusterGroup) {
          clusterGroup.addLayer(marker)
        } else if (map) {
          marker.addTo(map)
        }
      })

      if (clusterGroup) {
        map.addLayer(clusterGroup)
      }

      if (currentViewport) {
        map.setView(
          [currentViewport.lat, currentViewport.lng],
          currentViewport.z
        )
      } else {
        map.fitBounds(bounds.pad(0.35))
      }

      const updateVisiblePosts = () => {
        if (!map || !visibleCallbackRef.current) {
          return
        }

        const currentBounds = map.getBounds()
        const visible = currentPosts
          .filter((post) =>
            currentBounds.contains([post.location.lat, post.location.lng])
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
          z: map.getZoom(),
        })
      }

      updateVisiblePosts()
      updateViewport()
      map.on("moveend zoomend", updateVisiblePosts)
      map.on("moveend zoomend", updateViewport)
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

    map.setView([viewport.lat, viewport.lng], viewport.z, { animate: false })
  }, [viewport])

  return (
    <div className="overflow-hidden border border-border/70 shadow-sm">
      <div
        ref={mapRef}
        className="h-[360px] w-full sm:h-[420px] lg:h-[540px]"
        aria-label="Map of story locations"
      />
    </div>
  )
}
