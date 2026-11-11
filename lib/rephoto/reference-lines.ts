export const TRACE_OVERLAY_OPACITY = 0.16

// Editorial traces, tied to the exact uncropped archive. Coordinates are fractions
// of that image, not detections or a claim that the modern scene is unchanged.
export type ReferenceLines = {
  image: string
  features: { name: string; points: [number, number][] }[]
}
const guides: Record<string, ReferenceLines> = {
  "bradley-lane-line-road": {
    image: "/posts/0014-bradley-lane-line-road/then-bradley-lane-line-road.jpg",
    features: [
      {
        name: "Mural wall corner",
        points: [
          [0.396, 0.207],
          [0.392, 0.81],
        ],
      },
      {
        name: "Foot of mural wall",
        points: [
          [0.01, 0.787],
          [0.391, 0.825],
        ],
      },
      {
        name: "Front canopy underside",
        points: [
          [0.416, 0.311],
          [0.864, 0.294],
        ],
      },
      {
        name: "Receding canopy edge",
        points: [
          [0.864, 0.294],
          [0.894, 0.412],
        ],
      },
    ],
  },
  "tamaki-road-board-offices": {
    image:
      "/posts/0006-tamaki-road-board-offices/then-tamaki-road-board-offices.jpg",
    features: [
      {
        name: "Right roof hip",
        points: [
          [0.845, 0.323],
          [0.899, 0.218],
        ],
      },
      {
        name: "Eaves across the right facade",
        points: [
          [0.694, 0.35],
          [0.85, 0.335],
          [0.985, 0.339],
        ],
      },
      {
        name: "Right window left and lower frame",
        points: [
          [0.947, 0.4],
          [0.947, 0.533],
          [0.982, 0.533],
        ],
      },
    ],
  },
}
export function referenceLines(slug: string, image: string) {
  const guide = guides[slug]
  return guide?.image === image ? guide : null
}
