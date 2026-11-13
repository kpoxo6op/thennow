export const TRACE_OVERLAY_OPACITY = 0.16

// Editorial traces, tied to the exact uncropped archive. Coordinates are fractions
// of that image, not detections or a claim that the modern scene is unchanged.
export type ReferenceLines = {
  image: string
  features: { name: string; points: [number, number][]; region?: string }[]
}
const guides: Record<string, ReferenceLines> = {
  "bradley-lane-line-road": {
    image: "/posts/0014-bradley-lane-line-road/then-bradley-lane-line-road.jpg",
    features: [
      {
        name: "Mural wall corner",
        region: "wall",
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
        region: "wall",
        points: [
          [0.01, 0.787],
          [0.391, 0.825],
        ],
      },
      {
        name: "Front canopy underside",
        region: "canopy",
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
        region: "canopy",
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
        region: "roof",
        points: [
          [0.9, 0.21],
          [0.985, 0.215],
        ],
      },
      {
        name: "Left wing eaves",
        region: "roof",
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
        region: "roof",
        points: [
          [0.845, 0.323],
          [0.899, 0.218],
        ],
      },
      {
        name: "Eaves across the right facade",
        region: "roof",
        points: [
          [0.694, 0.35],
          [0.85, 0.335],
          [0.985, 0.339],
        ],
      },
      {
        name: "Right edge window frame",
        region: "window",
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
  "civic-theatre": {
    image: "/posts/0015-civic-theatre/then-civic-theatre.jpg",
    features: [
      {
        name: "Leftmost lattice screen",
        region: "left",
        points: [
          [0.14, 0.135],
          [0.14, 0.41],
        ],
      },
      {
        name: "Left lattice screen",
        region: "left",
        points: [
          [0.305, 0.06],
          [0.305, 0.41],
        ],
      },
      {
        name: "Second lattice screen",
        region: "left",
        points: [
          [0.4, 0.06],
          [0.4, 0.4],
        ],
      },
      {
        name: "Corner lattice above the entrance",
        region: "corner",
        points: [
          [0.571, 0.225],
          [0.571, 0.06],
        ],
      },
      {
        name: "Corner lattice right edge",
        region: "corner",
        points: [
          [0.65, 0.06],
          [0.65, 0.225],
        ],
      },
      {
        name: "Left corner pier",
        region: "corner",
        points: [
          [0.474, 0.35],
          [0.474, 0.5],
        ],
      },
      {
        name: "Right corner pier",
        region: "corner",
        points: [
          [0.754, 0.35],
          [0.754, 0.5],
        ],
      },
      {
        name: "Right lattice screen",
        region: "right",
        points: [
          [0.81, 0.06],
          [0.81, 0.4],
        ],
      },
      {
        name: "Far right lattice screen",
        region: "right",
        points: [
          [0.921, 0.06],
          [0.921, 0.4],
        ],
      },
    ],
  },
  "st-matthew-in-the-city": {
    image: "/posts/0016-st-matthew-in-the-city/then-st-matthew-in-the-city.jpg",
    features: [
      {
        name: "Tower left edge",
        region: "tower",
        points: [
          [0.199, 0.232],
          [0.199, 0.862],
        ],
      },
      {
        name: "Tower right edge",
        region: "tower",
        points: [
          [0.352, 0.232],
          [0.352, 0.69],
        ],
      },
      {
        name: "Tower parapet",
        region: "tower",
        points: [
          [0.202, 0.228],
          [0.35, 0.224],
        ],
      },
      {
        name: "Tall tower pinnacle",
        region: "tower",
        points: [
          [0.236, 0.17],
          [0.248, 0.102],
          [0.259, 0.17],
        ],
      },
      {
        name: "East gable",
        region: "east",
        points: [
          [0.651, 0.417],
          [0.696, 0.324],
          [0.743, 0.408],
        ],
      },
      {
        name: "East end left turret",
        region: "east",
        points: [
          [0.6, 0.43],
          [0.6, 0.82],
        ],
      },
      {
        name: "East end right turret",
        region: "east",
        points: [
          [0.781, 0.48],
          [0.781, 0.82],
        ],
      },
      {
        name: "Great east window sill",
        region: "east",
        points: [
          [0.651, 0.66],
          [0.743, 0.66],
        ],
      },
    ],
  },
  "auckland-art-gallery": {
    image: "/posts/0017-auckland-art-gallery/then-auckland-art-gallery.jpg",
    features: [
      {
        name: "Clock face",
        region: "tower",
        points: [
          [0.639, 0.257],
          [0.636, 0.27],
          [0.627, 0.278],
          [0.617, 0.278],
          [0.608, 0.27],
          [0.605, 0.257],
          [0.608, 0.244],
          [0.617, 0.236],
          [0.627, 0.236],
          [0.636, 0.244],
          [0.639, 0.257],
        ],
      },
      {
        name: "Clock tower left edge",
        region: "tower",
        points: [
          [0.602, 0.42],
          [0.602, 0.6],
        ],
      },
      {
        name: "Clock tower right edge",
        region: "tower",
        points: [
          [0.684, 0.45],
          [0.684, 0.8],
        ],
      },
      {
        name: "Public Library frieze",
        region: "facade",
        points: [
          [0.434, 0.623],
          [0.579, 0.623],
        ],
      },
      {
        name: "Arched window sills",
        region: "facade",
        points: [
          [0.306, 0.728],
          [0.436, 0.728],
        ],
      },
      {
        name: "Left entrance wing edge",
        region: "facade",
        points: [
          [0.174, 0.62],
          [0.174, 0.81],
        ],
      },
      {
        name: "Base along Kitchener Street",
        region: "facade",
        points: [
          [0.686, 0.836],
          [0.872, 0.832],
        ],
      },
      {
        name: "Kitchener Street pavilion corner",
        region: "facade",
        points: [
          [0.748, 0.6],
          [0.748, 0.83],
        ],
      },
    ],
  },
  "ferry-building": {
    image: "/posts/0018-ferry-building/then-ferry-building.jpg",
    features: [
      {
        name: "Wharf-side corner",
        region: "west",
        points: [
          [0.332, 0.5],
          [0.332, 0.848],
        ],
      },
      {
        name: "Wharf-side roofline",
        region: "west",
        points: [
          [0.336, 0.5],
          [0.504, 0.477],
        ],
      },
      {
        name: "Wharf-side cornice",
        region: "west",
        points: [
          [0.327, 0.579],
          [0.509, 0.574],
        ],
      },
      {
        name: "Base of wharf-side wall",
        region: "west",
        points: [
          [0.336, 0.848],
          [0.509, 0.848],
        ],
      },
      {
        name: "Front corner",
        region: "front",
        points: [
          [0.509, 0.477],
          [0.509, 0.848],
        ],
      },
      {
        name: "East end of front",
        region: "front",
        points: [
          [0.746, 0.63],
          [0.746, 0.835],
        ],
      },
      {
        name: "Clock face",
        region: "tower",
        points: [
          [0.624, 0.47],
          [0.622, 0.479],
          [0.617, 0.484],
          [0.609, 0.484],
          [0.604, 0.479],
          [0.602, 0.47],
          [0.604, 0.461],
          [0.609, 0.456],
          [0.617, 0.456],
          [0.622, 0.461],
          [0.624, 0.47],
        ],
      },
      {
        name: "Clock tower left edge",
        region: "tower",
        points: [
          [0.597, 0.45],
          [0.597, 0.55],
        ],
      },
      {
        name: "Clock tower right edge",
        region: "tower",
        points: [
          [0.671, 0.45],
          [0.671, 0.55],
        ],
      },
      {
        name: "Clock tower roof",
        region: "tower",
        points: [
          [0.591, 0.348],
          [0.626, 0.26],
          [0.664, 0.348],
        ],
      },
    ],
  },
  "chief-post-office": {
    image: "/posts/0019-chief-post-office/then-chief-post-office.jpg",
    features: [
      {
        name: "Large dome",
        region: "pavilion",
        points: [
          [0.58, 0.103],
          [0.593, 0.075],
          [0.629, 0.058],
          [0.664, 0.075],
          [0.677, 0.103],
        ],
      },
      {
        name: "Corner pavilion left edge",
        region: "pavilion",
        points: [
          [0.5, 0.31],
          [0.5, 0.81],
        ],
      },
      {
        name: "Rusticated corner",
        region: "pavilion",
        points: [
          [0.646, 0.5],
          [0.646, 0.8],
        ],
      },
      {
        name: "Small dome",
        region: "facade",
        points: [
          [0.249, 0.39],
          [0.257, 0.362],
          [0.281, 0.349],
          [0.304, 0.362],
          [0.313, 0.39],
        ],
      },
      {
        name: "Building base",
        region: "facade",
        points: [
          [0.5, 0.815],
          [0.207, 0.8],
        ],
      },
      {
        name: "Far end of facade",
        region: "facade",
        points: [
          [0.202, 0.47],
          [0.202, 0.8],
        ],
      },
    ],
  },
  customhouse: {
    image: "/posts/0020-customhouse/then-customhouse.jpg",
    features: [
      {
        name: "Left pavilion roof",
        region: "left",
        points: [
          [0.214, 0.326],
          [0.254, 0.21],
          [0.309, 0.21],
          [0.361, 0.35],
        ],
      },
      {
        name: "Left pavilion edge",
        region: "left",
        points: [
          [0.187, 0.33],
          [0.187, 0.877],
        ],
      },
      {
        name: "Tower left edge",
        region: "centre",
        points: [
          [0.524, 0.322],
          [0.524, 0.44],
        ],
      },
      {
        name: "Tower right edge",
        region: "centre",
        points: [
          [0.671, 0.322],
          [0.671, 0.44],
        ],
      },
      {
        name: "String course above ground floor",
        region: "centre",
        points: [
          [0.193, 0.658],
          [0.918, 0.718],
        ],
      },
      {
        name: "Building base",
        region: "centre",
        points: [
          [0.193, 0.877],
          [0.921, 0.83],
        ],
      },
      {
        name: "Right pavilion roof",
        region: "right",
        points: [
          [0.771, 0.452],
          [0.799, 0.368],
          [0.839, 0.368],
          [0.877, 0.466],
        ],
      },
      {
        name: "Albert Street corner",
        region: "right",
        points: [
          [0.921, 0.49],
          [0.921, 0.83],
        ],
      },
    ],
  },
}
export function referenceLines(slug: string, image: string) {
  const guide = guides[slug]
  return guide?.image === image ? guide : null
}
