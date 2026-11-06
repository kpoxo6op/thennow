"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react"
import type PostType from "@/interfaces/post"

import { clusterSpots, type SpotCluster } from "@/lib/map-clusters"
import { replaceListUrl } from "@/lib/story-return"

export type MapSpot = Pick<
  PostType,
  "slug" | "name" | "ba_imageUrl" | "location"
>

export type HomeMapHandle = {
  showAll: () => void
  // Limits the markers to these spots and frames them; null restores everything.
  setActive: (slugs: string[] | null, fit?: boolean) => void
  preview: (slug: string | null) => void
}

type Props = {
  spots: MapSpot[]
  onVisibleSlugsChange?: (
    slugs: string[],
    total: number,
    movedByVisitor: boolean
  ) => void
  onSelect?: (slug: string) => void
  onFailure?: () => void
}

const VIEWPORT_LIMITS = {
  minLat: -37.2,
  maxLat: -36.55,
  minLng: 174.25,
  maxLng: 175.05,
  minZoom: 8,
  maxZoom: 16,
}

const CLUSTER_RADIUS_PX = 46
// From here every spot gets its own marker.
const SEPARATE_ZOOM = 15
const POPUP_IMAGE_WIDTH = 384
// Marks camera moves started by our own controls rather than a map gesture.
const VISITOR_MOVE = "tnVisitorMove"

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function readUrlViewport() {
  const params = new URLSearchParams(window.location.search)
  const lat = Number(params.get("lat"))
  const lng = Number(params.get("lng"))
  const z = Number(params.get("z"))

  if (
    params.has("lat") &&
    params.has("lng") &&
    params.has("z") &&
    lat >= VIEWPORT_LIMITS.minLat &&
    lat <= VIEWPORT_LIMITS.maxLat &&
    lng >= VIEWPORT_LIMITS.minLng &&
    lng <= VIEWPORT_LIMITS.maxLng &&
    z >= VIEWPORT_LIMITS.minZoom &&
    z <= VIEWPORT_LIMITS.maxZoom
  ) {
    return { lat, lng, z }
  }

  return null
}

function writeUrlViewport(viewport: { lat: number; lng: number; z: number } | null) {
  const url = new URL(window.location.href)

  if (viewport) {
    url.searchParams.set(
      "lat",
      String(clamp(viewport.lat, VIEWPORT_LIMITS.minLat, VIEWPORT_LIMITS.maxLat))
    )
    url.searchParams.set(
      "lng",
      String(clamp(viewport.lng, VIEWPORT_LIMITS.minLng, VIEWPORT_LIMITS.maxLng))
    )
    url.searchParams.set(
      "z",
      String(clamp(viewport.z, VIEWPORT_LIMITS.minZoom, VIEWPORT_LIMITS.maxZoom))
    )
  } else {
    url.searchParams.delete("lat")
    url.searchParams.delete("lng")
    url.searchParams.delete("z")
  }

  // Keeps the view shareable without a server round trip.
  replaceListUrl(url)
}

export const HomeMap = forwardRef<HomeMapHandle, Props>(function HomeMap(
  { spots, onVisibleSlugsChange, onSelect, onFailure },
  ref
) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const showAllRef = useRef<() => void>(() => {})
  const setActiveRef = useRef<(slugs: string[] | null, fit?: boolean) => void>(
    () => {}
  )
  const previewRef = useRef<(slug: string | null) => void>(() => {})
  const pendingActiveRef = useRef<{ slugs: string[] | null; fit: boolean } | null>(null)
  const failureCallbackRef = useRef(onFailure)
  const spotsRef = useRef(spots)
  const visibleCallbackRef = useRef(onVisibleSlugsChange)
  const selectCallbackRef = useRef(onSelect)

  useEffect(() => {
    spotsRef.current = spots
    visibleCallbackRef.current = onVisibleSlugsChange
    selectCallbackRef.current = onSelect
    failureCallbackRef.current = onFailure
  }, [spots, onVisibleSlugsChange, onSelect, onFailure])

  useImperativeHandle(
    ref,
    () => ({
      showAll: () => showAllRef.current(),
      setActive: (slugs, fit = true) => {
        pendingActiveRef.current = { slugs, fit }
        setActiveRef.current(slugs, fit)
      },
      preview: (slug) => previewRef.current(slug),
    }),
    []
  )

  const spotsKey = useMemo(
    () =>
      spots
        .map(
          (spot) =>
            `${spot.slug}:${spot.location.lat.toFixed(6)}:${spot.location.lng.toFixed(6)}`
        )
        .join("|"),
    [spots]
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

      const currentSpots = spotsRef.current
      const allBounds = new maplibregl.LngLatBounds()
      currentSpots.forEach((spot) => {
        allBounds.extend([spot.location.lng, spot.location.lat])
      })

      const fitPadding = () =>
        Math.min(56, Math.round(Math.min(
          mapRef.current?.clientWidth ?? 0,
          mapRef.current?.clientHeight ?? 0
        ) / 8))
      const urlViewport = readUrlViewport()

      const activeMap = new maplibregl.Map({
        attributionControl: { compact: true },
        container: mapRef.current,
        maxBounds: [
          [174, -37.5],
          [175.3, -36.2],
        ],
        maxZoom: VIEWPORT_LIMITS.maxZoom,
        minZoom: VIEWPORT_LIMITS.minZoom,
        scrollZoom: false,
        style: "https://tiles.openfreemap.org/styles/liberty",
        ...(urlViewport
          ? {
              center: [urlViewport.lng, urlViewport.lat] as [number, number],
              zoom: urlViewport.z,
            }
          : {
              bounds: allBounds,
              fitBoundsOptions: { padding: fitPadding() },
            }),
      })
      map = activeMap

      activeMap.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right"
      )
      activeMap.touchZoomRotate.disableRotation()
      activeMap.dragRotate.disable()

      const canHover = window.matchMedia("(hover: hover)").matches
      const popup = new maplibregl.Popup({
        className: "tn-map-popup",
        closeButton: false,
        closeOnClick: true,
        // Focusing the card would scroll the map container from under the pointer.
        focusAfterOpen: false,
        maxWidth: "none",
        offset: 16,
      })
      let popupSlug: string | null = null
      let closeTimer: number | undefined

      const closePopup = () => {
        window.clearTimeout(closeTimer)
        popup.remove()
        popupSlug = null
      }

      const openPopup = (spot: MapSpot) => {
        window.clearTimeout(closeTimer)
        if (popupSlug === spot.slug) {
          return
        }

        const card = document.createElement("a")
        card.className = "tn-map-card"
        card.href = `/${spot.slug}`
        card.dataset.testid = "home-map-card"
        card.addEventListener("click", (event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey) {
            return
          }

          event.preventDefault()
          selectCallbackRef.current?.(spot.slug)
        })
        card.addEventListener("mouseenter", () =>
          window.clearTimeout(closeTimer)
        )
        card.addEventListener("mouseleave", () => scheduleClose())

        const image = document.createElement("img")
        image.alt = ""
        image.src = `/_next/image?url=${encodeURIComponent(spot.ba_imageUrl)}&w=${POPUP_IMAGE_WIDTH}&q=75`
        const title = document.createElement("span")
        title.textContent = spot.name
        card.append(image, title)

        popupSlug = spot.slug
        popup
          .setLngLat([spot.location.lng, spot.location.lat])
          .setDOMContent(card)
          .addTo(activeMap)
      }

      const scheduleClose = () => {
        window.clearTimeout(closeTimer)
        closeTimer = window.setTimeout(closePopup, 180)
      }

      popup.on("close", () => {
        popupSlug = null
      })

      const createSpotMarker = (spot: MapSpot) => {
        const element = document.createElement("a")
        element.className = "tn-map-marker"
        element.href = `/${spot.slug}`
        element.ariaLabel = spot.name
        element.dataset.testid = "home-map-marker"

        element.addEventListener("click", (event) => {
          event.stopPropagation()

          if (event.metaKey || event.ctrlKey || event.shiftKey) {
            return
          }

          event.preventDefault()

          // Touch has no hover: the first tap previews, the card opens the story.
          // Keyboard activation (detail 0) already previewed on focus.
          if (canHover || event.detail === 0) {
            selectCallbackRef.current?.(spot.slug)
          } else {
            openPopup(spot)
          }
        })
        element.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            closePopup()
          }
        })
        element.addEventListener("focus", () => openPopup(spot))
        element.addEventListener("blur", () => scheduleClose())

        if (canHover) {
          element.addEventListener("mouseenter", () => openPopup(spot))
          element.addEventListener("mouseleave", () => scheduleClose())
        }

        return element
      }

      const zoomIntoCluster = (cluster: SpotCluster<MapSpot>) => {
        const bounds = new maplibregl.LngLatBounds()
        cluster.spots.forEach((spot) => {
          bounds.extend([spot.location.lng, spot.location.lat])
        })

        const camera = activeMap.cameraForBounds(bounds, { padding: 64 })
        const nextZoom = Math.min(
          VIEWPORT_LIMITS.maxZoom,
          Math.max(camera?.zoom ?? 0, activeMap.getZoom() + 1.5)
        )

        closePopup()
        activeMap.easeTo({
          center: camera?.center ?? [cluster.location.lng, cluster.location.lat],
          duration: 450,
          zoom: nextZoom,
        }, { [VISITOR_MOVE]: true })
      }

      const createClusterMarker = (cluster: SpotCluster<MapSpot>) => {
        const element = document.createElement("button")
        element.type = "button"
        element.className = "tn-map-cluster"
        element.textContent = String(cluster.spots.length)
        element.ariaLabel = `${cluster.spots.length} stories`
        element.dataset.testid = "home-map-marker"
        element.addEventListener("click", (event) => {
          event.stopPropagation()
          zoomIntoCluster(cluster)

          // This marker goes away after the zoom; keep keyboard users on the map.
          if (event.detail === 0) {
            activeMap.getCanvas().focus({ preventScroll: true })
          }
        })

        return element
      }

      const markers = new Map<string, import("maplibre-gl").Marker>()

      let activeSpots = currentSpots

      const renderMarkers = () => {
        const zoom = activeMap.getZoom()
        const clusters = clusterSpots(
          activeSpots,
          zoom,
          zoom >= SEPARATE_ZOOM ? 0 : CLUSTER_RADIUS_PX
        )
        const next = new Set<string>()
        // Marker elements exist only near the view, whatever the zoom.
        const bounds = activeMap.getBounds()
        const latPad = (bounds.getNorth() - bounds.getSouth()) / 2
        const lngPad = (bounds.getEast() - bounds.getWest()) / 2
        const isNearView = ({ lat, lng }: { lat: number; lng: number }) =>
          lat >= bounds.getSouth() - latPad &&
          lat <= bounds.getNorth() + latPad &&
          lng >= bounds.getWest() - lngPad &&
          lng <= bounds.getEast() + lngPad

        // Markers kept just past the edge must not take keyboard focus.
        const setTabbable = (
          element: HTMLElement | undefined,
          cluster: SpotCluster<MapSpot>
        ) => {
          if (element) {
            element.tabIndex = bounds.contains([
              cluster.location.lng,
              cluster.location.lat,
            ])
              ? 0
              : -1
          }
        }

        clusters.forEach((cluster) => {
          if (!isNearView(cluster.location)) {
            return
          }

          const key = `${cluster.spots[0].slug}:${cluster.spots.length}`
          next.add(key)

          if (markers.has(key)) {
            const marker = markers.get(key)
            marker?.setLngLat([cluster.location.lng, cluster.location.lat])
            setTabbable(marker?.getElement(), cluster)
            return
          }

          const element =
            cluster.spots.length === 1
              ? createSpotMarker(cluster.spots[0])
              : createClusterMarker(cluster)

          setTabbable(element, cluster)
          markers.set(
            key,
            new maplibregl.Marker({ element })
              .setLngLat([cluster.location.lng, cluster.location.lat])
              .addTo(activeMap)
          )
        })

        markers.forEach((marker, key) => {
          if (!next.has(key)) {
            marker.remove()
            markers.delete(key)
          }
        })
      }

      const updateVisibleSpots = (movedByVisitor = false) => {
        const bounds = activeMap.getBounds()
        visibleCallbackRef.current?.(
          currentSpots
            .filter((spot) =>
              bounds.contains([spot.location.lng, spot.location.lat])
            )
            .map((spot) => spot.slug),
          currentSpots.length,
          movedByVisitor
        )
      }

      // The fitted view is "everything"; only views the visitor chose reach the URL.
      let fittedView = urlViewport
        ? null
        : { center: activeMap.getCenter(), zoom: activeMap.getZoom() }

      const updateUrl = () => {
        const center = activeMap.getCenter()
        const zoom = activeMap.getZoom()

        if (
          fittedView &&
          Math.abs(fittedView.center.lat - center.lat) < 0.00001 &&
          Math.abs(fittedView.center.lng - center.lng) < 0.00001 &&
          Math.abs(fittedView.zoom - zoom) < 0.001
        ) {
          writeUrlViewport(null)
          return
        }

        fittedView = null
        writeUrlViewport({
          lat: Number(center.lat.toFixed(6)),
          lng: Number(center.lng.toFixed(6)),
          z: Number(zoom.toFixed(2)),
        })
      }

      const fitAll = (duration: number) => {
        const camera = activeMap.cameraForBounds(allBounds, {
          padding: fitPadding(),
        })

        if (!camera?.center || camera.zoom === undefined) {
          return
        }

        const center = maplibregl.LngLat.convert(camera.center)
        const zoom = Math.max(camera.zoom, activeMap.getMinZoom())
        fittedView = { center, zoom }
        closePopup()
        activeMap.easeTo(
          { center, duration, zoom },
          duration > 0 ? { [VISITOR_MOVE]: true } : undefined
        )
      }

      showAllRef.current = () => fitAll(450)

      setActiveRef.current = (slugs, fit = true) => {
        const active = slugs ? new Set(slugs) : null
        activeSpots = active
          ? currentSpots.filter((spot) => active.has(spot.slug))
          : currentSpots
        closePopup()
        renderMarkers()

        if (!fit) {
          return
        }

        if (!active) {
          fitAll(450)
          return
        }

        if (activeSpots.length === 0) {
          return
        }

        const bounds = new maplibregl.LngLatBounds()
        activeSpots.forEach((spot) => {
          bounds.extend([spot.location.lng, spot.location.lat])
        })
        activeMap.fitBounds(bounds, {
          duration: 450,
          maxZoom: 14,
          padding: fitPadding(),
        })
      }

      previewRef.current = (slug) => {
        if (!canHover) {
          return
        }

        const spot = slug
          ? currentSpots.find((candidate) => candidate.slug === slug)
          : null

        if (spot) {
          openPopup(spot)
        } else {
          scheduleClose()
        }
      }

      if (pendingActiveRef.current) {
        setActiveRef.current(
          pendingActiveRef.current.slugs,
          pendingActiveRef.current.fit
        )
      }

      // Arriving from a story: say which of the markers it is.
      const arrivedFrom = new URLSearchParams(window.location.search).get("spot")
      const arrivedSpot = currentSpots.find((spot) => spot.slug === arrivedFrom)
      if (arrivedSpot) {
        openPopup(arrivedSpot)
      }

      // A hidden pane measures as a default size, not as what the visitor saw.
      const isPaneHidden = () => !mapRef.current?.clientWidth

      activeMap.on("moveend", (event) => {
        if (isPaneHidden()) {
          return
        }

        renderMarkers()
        updateVisibleSpots(
          Boolean(event.originalEvent) || VISITOR_MOVE in event
        )
        updateUrl()
      })
      activeMap.on("resize", () => {
        if (isPaneHidden()) {
          return
        }

        if (fittedView) {
          fitAll(0)
        }
        updateVisibleSpots()
      })
      activeMap.on("error", () => {
        if (!activeMap.isStyleLoaded()) {
          failureCallbackRef.current?.()
        }
      })
      // Compact attribution starts expanded and would sit on the markers.
      const collapseAttribution = () =>
        mapRef.current
          ?.querySelector(".maplibregl-ctrl-attrib")
          ?.classList.remove("maplibregl-compact-show")

      collapseAttribution()
      activeMap.once("load", collapseAttribution)

      renderMarkers()
      updateVisibleSpots()
    }

    // The map is below the first screen, and hidden on phones until asked for.
    let idleHandle = 0
    const container = mapRef.current
    const startWhenVisible = new ResizeObserver(() => {
      if (container && container.clientWidth > 0 && container.clientHeight > 0) {
        startWhenVisible.disconnect()
        idleHandle = window.setTimeout(setupMap, 0)
      }
    })
    const startTimer = window.setTimeout(() => {
      if (container) {
        startWhenVisible.observe(container)
      }
    }, 300)

    return () => {
      isMounted = false
      window.clearTimeout(startTimer)
      window.clearTimeout(idleHandle)
      startWhenVisible.disconnect()
      showAllRef.current = () => {}
      setActiveRef.current = () => {}
      previewRef.current = () => {}
      map?.remove()
    }
  }, [spotsKey])

  return (
    <div
      ref={mapRef}
      data-testid="home-map"
      className="tn-map size-full"
      role="region"
      aria-label="Map of story locations"
    />
  )
})
