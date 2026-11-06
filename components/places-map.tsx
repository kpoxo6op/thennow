"use client"

import { useEffect, useMemo, useRef, type RefObject } from "react"
import type { StorySummary } from "@/interfaces/post"

export type MapViewport = {
  lat: number
  lng: number
  z: number
}

export type MapHighlight = (slug: string | null) => void

type StoryCluster = {
  key: string
  lat: number
  lng: number
  stories: StorySummary[]
}

const MAX_ZOOM = 16
// Clear of the controls, so no marker hugs an edge.
const FIT_PADDING = { top: 96, bottom: 96, left: 72, right: 72 }
const CLUSTER_RADIUS_PX = 34
// At full zoom only near-identical spots still share a marker.
const MAX_ZOOM_CLUSTER_RADIUS_PX = 12

function worldPoint(lat: number, lng: number, zoom: number) {
  const size = 512 * 2 ** zoom
  const sin = Math.sin((lat * Math.PI) / 180)

  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  }
}

function clusterStories(stories: StorySummary[], zoom: number): StoryCluster[] {
  const radius =
    zoom >= MAX_ZOOM ? MAX_ZOOM_CLUSTER_RADIUS_PX : CLUSTER_RADIUS_PX
  const groups: { x: number; y: number; stories: StorySummary[] }[] = []

  stories.forEach((story) => {
    const point = worldPoint(story.location.lat, story.location.lng, zoom)
    const group = groups.find(
      (candidate) =>
        Math.hypot(candidate.x - point.x, candidate.y - point.y) <= radius
    )

    if (group) {
      group.stories.push(story)
    } else {
      groups.push({ ...point, stories: [story] })
    }
  })

  return groups.map((group) => ({
    key: group.stories.map((story) => story.slug).join(","),
    lat:
      group.stories.reduce((sum, story) => sum + story.location.lat, 0) /
      group.stories.length,
    lng:
      group.stories.reduce((sum, story) => sum + story.location.lng, 0) /
      group.stories.length,
    stories: group.stories,
  }))
}

type Props = {
  stories: StorySummary[]
  selected?: StorySummary[] | null
  onVisibleSlugsChange?: (slugs: string[]) => void
  onViewportChange?: (viewport: MapViewport) => void
  onSelect?: (stories: StorySummary[] | null) => void
  onFail?: (failed: boolean) => void
  highlightRef?: RefObject<MapHighlight | null>
  viewport?: MapViewport | null
}

export function PlacesMap({
  stories,
  selected,
  onVisibleSlugsChange,
  onViewportChange,
  onSelect,
  onFail,
  highlightRef,
  viewport,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const storiesRef = useRef(stories)
  const viewportRef = useRef(viewport)
  const callbacksRef = useRef({ onVisibleSlugsChange, onViewportChange, onSelect, onFail })
  const refreshRef = useRef<((fit: boolean) => void) | null>(null)
  const selectedSlugsRef = useRef<string[]>([])
  const applyActiveRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    callbacksRef.current = { onVisibleSlugsChange, onViewportChange, onSelect, onFail }
  }, [onVisibleSlugsChange, onViewportChange, onSelect, onFail])

  const storiesKey = useMemo(
    () => stories.map((story) => story.slug).join(","),
    [stories]
  )
  const appliedKeyRef = useRef(storiesKey)

  useEffect(() => {
    storiesRef.current = stories
    viewportRef.current = viewport
  }, [stories, viewport])

  useEffect(() => {
    let isMounted = true
    let map: import("maplibre-gl").Map | null = null

    async function setupMap() {
      const maplibreModule = await import("maplibre-gl")
      const maplibregl = maplibreModule.default ?? maplibreModule

      if (!isMounted || !containerRef.current) {
        return
      }

      const boundsOf = (list: StorySummary[]) => {
        const bounds = new maplibregl.LngLatBounds()
        list.forEach((story) => {
          bounds.extend([story.location.lng, story.location.lat])
        })
        return bounds
      }

      const initialStories = storiesRef.current
      const initialViewport = viewportRef.current

      try {
        map = new maplibregl.Map({
          attributionControl: { compact: true },
          container: containerRef.current,
          maxZoom: MAX_ZOOM,
          minZoom: 8,
          scrollZoom: true,
          style: "https://tiles.openfreemap.org/styles/liberty",
          ...(initialViewport
            ? {
                center: [initialViewport.lng, initialViewport.lat] as [number, number],
                zoom: initialViewport.z,
              }
            : initialStories.length > 0
              ? {
                  bounds: boundsOf(initialStories),
                  fitBoundsOptions: { padding: FIT_PADDING, maxZoom: 15 },
                }
              : { center: [174.76, -36.85] as [number, number], zoom: 10 }),
        })
      } catch {
        // No WebGL: the photo view and search still reach every place.
        callbacksRef.current.onFail?.(true)
        return
      }

      const activeMap = map
      let styleLoaded = false

      activeMap.on("load", () => {
        styleLoaded = true
        callbacksRef.current.onFail?.(false)
        const attribution = activeMap
          .getContainer()
          .querySelector(".maplibregl-ctrl-attrib")
        attribution?.classList.remove("maplibregl-compact-show")
        attribution?.removeAttribute("open")
      })
      activeMap.on("error", () => {
        if (!styleLoaded) {
          callbacksRef.current.onFail?.(true)
        }
      })

      activeMap.touchZoomRotate.disableRotation()
      activeMap.dragRotate.disable()
      activeMap.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right"
      )
      activeMap.on("click", () => {
        callbacksRef.current.onSelect?.(null)
      })

      const expandCluster = (cluster: StoryCluster) => {
        const camera = activeMap.cameraForBounds(boundsOf(cluster.stories), { padding: 64 })
        // Sprawling clusters on a small map still have to get closer per tap.
        const nextLevel = Math.floor(activeMap.getZoom()) + 2
        const fitsBounds = (camera?.zoom ?? 0) >= nextLevel

        activeMap.easeTo({
          center: fitsBounds && camera?.center ? camera.center : [cluster.lng, cluster.lat],
          zoom: Math.min(MAX_ZOOM, Math.max(camera?.zoom ?? 0, nextLevel)),
          duration: 450,
        })
      }

      let clusterCache = new Map<number, StoryCluster[]>()
      const liveMarkers = new Map<
        string,
        { element: HTMLElement; marker: import("maplibre-gl").Marker }
      >()
      let highlighted: string | null = null

      const applyActive = () => {
        liveMarkers.forEach(({ element }, key) => {
          element.classList.toggle(
            "is-active",
            key.split(",").some(
              (slug) => slug === highlighted || selectedSlugsRef.current.includes(slug)
            )
          )
        })
      }

      if (highlightRef) {
        highlightRef.current = (slug) => {
          highlighted = slug
          applyActive()
        }
      }

      applyActiveRef.current = applyActive

      const createMarker = (cluster: StoryCluster) => {
        const isSingle = cluster.stories.length === 1
        const element = document.createElement("a")
        element.className = `tn-map-marker tn-map-marker--${isSingle ? "point" : "cluster"}`
        element.href = `/${cluster.stories[0].slug}`
        element.ariaLabel = isSingle
          ? cluster.stories[0].name
          : `${cluster.stories.length} places`
        element.dataset.testid = "home-map-marker"
        element.dataset.count = String(cluster.stories.length)

        const face = document.createElement("span")
        face.textContent = isSingle ? "" : String(cluster.stories.length)
        element.append(face)

        element.addEventListener("click", (event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey) {
            return
          }

          event.preventDefault()
          event.stopPropagation()

          if (isSingle || activeMap.getZoom() >= MAX_ZOOM) {
            callbacksRef.current.onSelect?.(cluster.stories)
          } else {
            callbacksRef.current.onSelect?.(null)
            expandCluster(cluster)
          }
        })

        return element
      }

      const updateMarkers = () => {
        const level = Math.min(MAX_ZOOM, Math.floor(activeMap.getZoom()))
        let clusters = clusterCache.get(level)

        if (!clusters) {
          clusters = clusterStories(storiesRef.current, level)
          clusterCache.set(level, clusters)
        }

        // Only what is around the view exists, which keeps keyboard order short.
        const near = activeMap.getBounds()
        const latPad = (near.getNorth() - near.getSouth()) * 0.25
        const lngPad = (near.getEast() - near.getWest()) * 0.25
        const isNear = (cluster: StoryCluster) =>
          cluster.lat <= near.getNorth() + latPad &&
          cluster.lat >= near.getSouth() - latPad &&
          cluster.lng <= near.getEast() + lngPad &&
          cluster.lng >= near.getWest() - lngPad

        const nextKeys = new Set<string>()

        clusters.filter(isNear).forEach((cluster) => {
          nextKeys.add(cluster.key)

          if (!liveMarkers.has(cluster.key)) {
            const element = createMarker(cluster)
            const marker = new maplibregl.Marker({ element })
              .setLngLat([cluster.lng, cluster.lat])
              .addTo(activeMap)
            liveMarkers.set(cluster.key, { element, marker })
          }
        })

        liveMarkers.forEach(({ marker }, key) => {
          if (!nextKeys.has(key)) {
            marker.remove()
            liveMarkers.delete(key)
          }
        })

        applyActive()
      }

      const reportVisible = () => {
        if (!isMounted) {
          return
        }

        const bounds = activeMap.getBounds()
        callbacksRef.current.onVisibleSlugsChange?.(
          storiesRef.current
            .filter((story) =>
              bounds.contains([story.location.lng, story.location.lat])
            )
            .map((story) => story.slug)
        )
      }

      const reportViewport = () => {
        if (!isMounted) {
          return
        }

        const center = activeMap.getCenter()
        callbacksRef.current.onViewportChange?.({
          lat: Number(center.lat.toFixed(6)),
          lng: Number(center.lng.toFixed(6)),
          z: Number(activeMap.getZoom().toFixed(2)),
        })
      }

      refreshRef.current = (fit) => {
        clusterCache = new Map()
        updateMarkers()
        reportVisible()

        if (fit && storiesRef.current.length > 0) {
          activeMap.fitBounds(boundsOf(storiesRef.current), {
            padding: FIT_PADDING,
            maxZoom: 15,
            duration: 500,
          })
        }
      }

      updateMarkers()
      reportVisible()
      activeMap.on("moveend", updateMarkers)
      activeMap.on("moveend", reportVisible)
      activeMap.on("moveend", reportViewport)
    }

    setupMap()

    return () => {
      isMounted = false
      refreshRef.current = null
      applyActiveRef.current = null
      if (highlightRef) {
        highlightRef.current = null
      }
      map?.remove()
    }
  }, [highlightRef])

  // A new search or area re-frames the map on what it found.
  useEffect(() => {
    if (appliedKeyRef.current === storiesKey) {
      return
    }

    appliedKeyRef.current = storiesKey
    refreshRef.current?.(true)
  }, [storiesKey])

  useEffect(() => {
    selectedSlugsRef.current = selected?.map((story) => story.slug) ?? []
    applyActiveRef.current?.()
  }, [selected])

  return (
    <div
      ref={containerRef}
      data-testid="home-map"
      className="size-full"
      role="region"
      aria-label="Map of places"
    />
  )
}
