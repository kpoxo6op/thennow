"use client"

import { useEffect, useMemo, useRef } from "react"
import type PostType from "@/interfaces/post"

type MapVariant = "default" | "muted" | "paper" | "mono"

type Props = {
  posts: PostType[]
  title: string
  variant: MapVariant
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function OSMExperimentMap({ posts, title, variant }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null)

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

      map = L.map(mapRef.current, {
        attributionControl: false,
        keyboard: false,
        scrollWheelZoom: false,
      })

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      const bounds = L.latLngBounds(
        posts.map(
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

      posts.forEach((post) => {
        const marker = L.circleMarker([post.location.lat, post.location.lng], {
          radius: 7,
          color: "#ffffff",
          weight: 3,
          fillColor: variant === "default" ? "#0f172a" : "#111827",
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

      map.fitBounds(bounds.pad(0.35))
    }

    setupMap()

    return () => {
      isMounted = false
      map?.remove()
    }
  }, [posts, postsKey, variant])

  return (
    <article className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">
          Raster OSM only. This is just visual softening, not true layer
          removal.
        </p>
      </div>
      <div className="overflow-hidden border border-border/70 shadow-sm">
        <div
          ref={mapRef}
          className={`tn-osm-variant tn-osm-variant--${variant} h-[320px] w-full sm:h-[380px]`}
        />
      </div>
    </article>
  )
}
