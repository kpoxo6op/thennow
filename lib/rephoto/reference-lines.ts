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
          [0.396, 0.01],
          [0.392, 0.81],
        ],
      },
      {
        name: "Cowboy boot outline",
        points: [
          [0.026, 0.318],
          [0.034, 0.345],
          [0.027, 0.363],
          [0.013, 0.391],
          [0.001, 0.394],
        ],
      },
      {
        name: "Long mural wall joint",
        points: [
          [0.025, 0.315],
          [0.349, 0.297],
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
        name: "Shopfront base receding from wall corner",
        points: [
          [0.405, 0.811],
          [0.674, 0.687],
        ],
      },
      {
        name: "Shopfront window upright",
        points: [
          [0.626, 0.423],
          [0.624, 0.703],
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
        name: "Visible distant horizon at left edge",
        points: [
          [0.039, 0.496],
          [0.068, 0.496],
        ],
      },
      {
        name: "Long street kerb",
        points: [
          [0.29, 0.579],
          [0.615, 0.7],
          [0.985, 0.818],
        ],
      },
      {
        name: "Right roof ridge near frame edge",
        points: [
          [0.9, 0.21],
          [0.985, 0.215],
        ],
      },
      {
        name: "Left wing eaves",
        points: [
          [0.538, 0.374],
          [0.602, 0.366],
        ],
      },
      {
        name: "Base of right brick facade",
        points: [
          [0.718, 0.573],
          [0.849, 0.603],
          [0.985, 0.598],
        ],
      },
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
        name: "Right edge window frame",
        points: [
          [0.947, 0.4],
          [0.947, 0.533],
          [0.982, 0.533],
          [0.982, 0.4],
          [0.947, 0.4],
        ],
      },
    ],
  },
}
export function referenceLines(slug: string, image: string) {
  const guide = guides[slug]
  return guide?.image === image ? guide : null
}
