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
const CLUSTER_RADIUS_PX = 34
// At full zoom only near-identical spots still share a marker.
const MAX_ZOOM_CLUSTER_RADIUS_PX = 12

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function worldPoint(lat: number, lng: number, zoom: number) {
  const size = 512 * 2 ** zoom
  const sin = Math.sin((lat * Math.PI) / 180)

  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  }
}

function clusterStories(posts: StorySummary[], zoom: number): StoryCluster[] {
  const radius =
    zoom >= MAX_ZOOM ? MAX_ZOOM_CLUSTER_RADIUS_PX : CLUSTER_RADIUS_PX
  const groups: { x: number; y: number; stories: StorySummary[] }[] = []

  posts.forEach((post) => {
    const point = worldPoint(post.location.lat, post.location.lng, zoom)
    const group = groups.find(
      (candidate) =>
        Math.hypot(candidate.x - point.x, candidate.y - point.y) <= radius
    )

    if (group) {
      group.stories.push(post)
    } else {
      groups.push({ ...point, stories: [post] })
    }
  })

  return groups.map(({ stories }) => ({
    key: stories.map((story) => story.slug).join(","),
    lat:
      stories.reduce((sum, story) => sum + story.location.lat, 0) /
      stories.length,
    lng:
      stories.reduce((sum, story) => sum + story.location.lng, 0) /
      stories.length,
    stories,
  }))
}

function popupThumbnail(url: string) {
  return `/_next/image?url=${encodeURIComponent(url)}&w=640&q=75`
}

function popupHtml(stories: StorySummary[]) {
  return stories
    .map(
      (story) => `
        <a class="tn-popup-story" href="/${story.slug}" data-slug="${story.slug}">
          <img src="${popupThumbnail(story.ba_imageUrl)}" alt="" />
          <span>${escapeHtml(story.name)}</span>
        </a>
      `
    )
    .join("")
}

type Props = {
  posts: StorySummary[]
  onVisibleSlugsChange?: (slugs: string[]) => void
  onViewportChange?: (viewport: MapViewport) => void
  onOpenStory?: (slug: string) => void
  highlightRef?: RefObject<MapHighlight | null>
  viewport?: MapViewport | null
}

export function HomeMap({
  posts,
  onVisibleSlugsChange,
  onViewportChange,
  onOpenStory,
  highlightRef,
  viewport,
}: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<import("maplibre-gl").Map | null>(null)
  const postsRef = useRef(posts)
  const viewportRef = useRef(viewport)
  const visibleCallbackRef = useRef(onVisibleSlugsChange)
  const viewportCallbackRef = useRef(onViewportChange)
  const openStoryRef = useRef(onOpenStory)

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

  useEffect(() => {
    openStoryRef.current = onOpenStory
  }, [onOpenStory])

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
      const wholeCollection = new maplibregl.LngLatBounds()
      currentPosts.forEach((post) => {
        wholeCollection.extend([post.location.lng, post.location.lat])
      })

      map = new maplibregl.Map({
        attributionControl: { compact: true },
        container: mapRef.current,
        maxZoom: MAX_ZOOM,
        minZoom: 8,
        scrollZoom: window.matchMedia("(min-width: 1024px)").matches,
        style: "https://tiles.openfreemap.org/styles/liberty",
        ...(currentViewport
          ? {
              center: [currentViewport.lng, currentViewport.lat] as [
                number,
                number,
              ],
              zoom: currentViewport.z,
            }
          : {
              bounds: wholeCollection,
              fitBoundsOptions: { padding: 44 },
            }),
      })
      mapInstanceRef.current = map
      const activeMap = map

      activeMap.touchZoomRotate.disableRotation()
      activeMap.dragRotate.disable()
      activeMap.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right"
      )

      // Credit stays one tap away instead of lying across the map.
      activeMap.once("load", () => {
        activeMap
          .getContainer()
          .querySelector(".maplibregl-ctrl-attrib")
          ?.classList.remove("maplibregl-compact-show")
        activeMap
          .getContainer()
          .querySelector(".maplibregl-ctrl-attrib")
          ?.removeAttribute("open")
      })

      const popup = new maplibregl.Popup({
        className: "tn-popup",
        closeButton: false,
        closeOnClick: true,
        maxWidth: "none",
        offset: 16,
      })

      const openPopup = (cluster: StoryCluster) => {
        popup
          .setLngLat([cluster.lng, cluster.lat])
          .setHTML(popupHtml(cluster.stories))
          .addTo(activeMap)

        popup
          .getElement()
          .querySelectorAll<HTMLAnchorElement>("a[data-slug]")
          .forEach((link) => {
            link.addEventListener("click", (event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey) {
                return
              }

              event.preventDefault()
              openStoryRef.current?.(link.dataset.slug ?? "")
            })
          })
      }

      const expandCluster = (cluster: StoryCluster) => {
        const bounds = new maplibregl.LngLatBounds()
        cluster.stories.forEach((story) => {
          bounds.extend([story.location.lng, story.location.lat])
        })

        const camera = activeMap.cameraForBounds(bounds, { padding: 64 })
        // Sprawling clusters on a small map still have to get closer per tap.
        const nextLevel = Math.floor(activeMap.getZoom()) + 2
        const fitsBounds = (camera?.zoom ?? 0) >= nextLevel

        activeMap.easeTo({
          center: fitsBounds && camera?.center
            ? camera.center
            : [cluster.lng, cluster.lat],
          zoom: Math.min(MAX_ZOOM, Math.max(camera?.zoom ?? 0, nextLevel)),
          duration: 450,
        })
      }

      const clusterCache = new Map<number, StoryCluster[]>()
      const liveMarkers = new Map<
        string,
        { element: HTMLElement; marker: import("maplibre-gl").Marker }
      >()
      let highlighted: string | null = null

      const applyHighlight = () => {
        liveMarkers.forEach(({ element }, key) => {
          element.classList.toggle(
            "is-active",
            highlighted !== null && key.split(",").includes(highlighted)
          )
        })
      }

      if (highlightRef) {
        highlightRef.current = (slug) => {
          highlighted = slug
          applyHighlight()
        }
      }

      const createMarker = (cluster: StoryCluster) => {
        const isSingle = cluster.stories.length === 1
        const element = document.createElement("a")
        element.className = `tn-map-marker tn-map-marker--${isSingle ? "point" : "cluster"}`
        element.href = `/${cluster.stories[0].slug}`
        element.ariaLabel = isSingle
          ? cluster.stories[0].name
          : `${cluster.stories.length} stories`
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
            openPopup(cluster)
          } else {
            popup.remove()
            expandCluster(cluster)
          }
        })

        return element
      }

      const updateMarkers = () => {
        const level = Math.min(MAX_ZOOM, Math.floor(activeMap.getZoom()))
        let clusters = clusterCache.get(level)

        if (!clusters) {
          clusters = clusterStories(currentPosts, level)
          clusterCache.set(level, clusters)
        }

        const nextKeys = new Set<string>()

        clusters.forEach((cluster) => {
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

        applyHighlight()
      }

      const updateVisiblePosts = () => {
        if (!isMounted || !map || !visibleCallbackRef.current) {
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
        if (!isMounted || !map || !viewportCallbackRef.current) {
          return
        }

        const center = map.getCenter()
        viewportCallbackRef.current({
          lat: Number(center.lat.toFixed(6)),
          lng: Number(center.lng.toFixed(6)),
          z: Number(map.getZoom().toFixed(2)),
        })
      }

      updateMarkers()
      updateVisiblePosts()
      updateViewport()
      map.on("moveend", updateMarkers)
      map.on("moveend", updateVisiblePosts)
      map.on("moveend", updateViewport)
    }

    setupMap()

    return () => {
      isMounted = false
      mapInstanceRef.current = null
      if (highlightRef) {
        highlightRef.current = null
      }
      map?.remove()
    }
  }, [postsKey, highlightRef])

  useEffect(() => {
    const map = mapInstanceRef.current

    if (!map || !viewport) {
      return
    }

    const center = map.getCenter()
    const latDelta = Math.abs(center.lat - viewport.lat)
    const lngDelta = Math.abs(center.lng - viewport.lng)
    const zoomDelta = Math.abs(map.getZoom() - viewport.z)

    if (latDelta <= 0.000001 && lngDelta <= 0.000001 && zoomDelta <= 0.01) {
      return
    }

    if (map.isMoving()) {
      return
    }

    map.jumpTo({ center: [viewport.lng, viewport.lat], zoom: viewport.z })
  }, [viewport])

  return (
    <div
      ref={mapRef}
      data-testid="home-map"
      className="size-full"
      aria-label="Map of story locations"
    />
  )
}
