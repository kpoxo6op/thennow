import type { PostLocation } from "@/interfaces/post"

const WORLD_SIZE = 512

function project({ lat, lng }: PostLocation, zoom: number) {
  const scale = WORLD_SIZE * 2 ** zoom
  const sin = Math.sin((lat * Math.PI) / 180)

  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  }
}

export type SpotCluster<T> = {
  spots: T[]
  location: PostLocation
}

// Greedy grouping in world pixels, so groups stay put while panning.
export function clusterSpots<T extends { location: PostLocation }>(
  spots: T[],
  zoom: number,
  radius: number
): SpotCluster<T>[] {
  const groups: { x: number; y: number; spots: T[] }[] = []

  spots.forEach((spot) => {
    const { x, y } = project(spot.location, zoom)
    const group = groups.find(
      (candidate) => Math.hypot(candidate.x - x, candidate.y - y) < radius
    )

    if (group) {
      group.spots.push(spot)
    } else {
      groups.push({ x, y, spots: [spot] })
    }
  })

  return groups.map((group) => ({
    spots: group.spots,
    // The first spot anchors the group, which keeps group markers from colliding.
    location: group.spots[0].location,
  }))
}
