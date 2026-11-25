import type { Zones } from "@/lib/rephoto/parallax"

export const TRACE_OVERLAY_OPACITY = 0.16

// Editorial traces, tied to the exact uncropped archive. Coordinates are fractions
// of that image, not detections or a claim that the modern scene is unchanged.
export type ReferenceLines = {
  image: string
  features: {
    name: string
    points: [number, number][]
    region?: string
    // Its lettering pins it along its length too, so a sideways shift can be measured.
    along?: boolean
  }[]
  // Which part of the old photo is near and which far, for telling where to stand (parallax).
  zones?: Zones
}
const guides: Record<string, ReferenceLines> = {
  "riddell-road-waimarie-street": {
    image:
      "/posts/0009-riddell-road-waimarie-street/then-riddell-road-waimarie-street.jpg",
    features: [
      {
        name: "Distant rise of Riddell Road, left edge",
        points: [
          [0.19893, 0.56167],
          [0.20561, 0.54333],
          [0.21896, 0.51],
        ],
      },
      {
        name: "Opposite edge of the distant rise",
        points: [
          [0.21896, 0.56],
          [0.2243, 0.53],
          [0.23231, 0.505],
        ],
      },
      {
        name: "Far ridge beyond the junction",
        points: [
          [0.24566, 0.505],
          [0.28037, 0.50167],
          [0.29907, 0.505],
          [0.33645, 0.49833],
          [0.36315, 0.50333],
        ],
      },
      {
        name: "Left footpath approaching the junction",
        points: [
          [0.01335, 0.625],
          [0.06142, 0.61167],
          [0.11348, 0.595],
          [0.16689, 0.58333],
        ],
      },
      {
        name: "Shop-side return into Waimarie Street",
        points: [
          [0.39252, 0.59],
          [0.43925, 0.60833],
          [0.49666, 0.62833],
          [0.53004, 0.64333],
          [0.53939, 0.65333],
          [0.53405, 0.665],
        ],
      },
      {
        name: "Near curve at the footpath",
        points: [
          [0.5247, 0.68167],
          [0.51402, 0.71],
          [0.50601, 0.745],
          [0.51001, 0.77],
          [0.53271, 0.81167],
          [0.57276, 0.865],
          [0.62483, 0.91833],
          [0.6996, 0.99333],
        ],
      },
    ],
  },
  "st-heliers-beach-gower-point": {
    image:
      "/posts/0008-st-heliers-beach-gower-point/then-st-heliers-beach-gower-point.jpg",
    features: [
      {
        name: "Gower Point slope above the water",
        points: [
          [0.32036, 0.49833],
          [0.33852, 0.51167],
          [0.35798, 0.51833],
          [0.38003, 0.52167],
          [0.40597, 0.52833],
        ],
      },
      {
        name: "Foot of the point",
        points: [
          [0.32425, 0.545],
          [0.36446, 0.54333],
          [0.39948, 0.54],
          [0.42023, 0.53333],
        ],
      },
      {
        name: "Open harbour horizon",
        points: [
          [0.4358, 0.535],
          [0.50065, 0.53333],
          [0.53956, 0.52833],
          [0.59533, 0.53],
          [0.67315, 0.52667],
        ],
      },
      {
        name: "Low island summit",
        points: [
          [0.68482, 0.525],
          [0.70298, 0.51833],
          [0.71595, 0.51333],
          [0.73152, 0.515],
          [0.74838, 0.52333],
        ],
      },
      {
        name: "Right island ridge",
        points: [
          [0.77302, 0.52667],
          [0.79767, 0.52],
          [0.8275, 0.51333],
          [0.85084, 0.51167],
          [0.87678, 0.51667],
          [0.89364, 0.52333],
        ],
      },
      {
        name: "Edge of the promenade above the sand",
        points: [
          [0.53178, 0.68667],
          [0.62516, 0.69],
          [0.6978, 0.69667],
          [0.75616, 0.70667],
          [0.85603, 0.71667],
          [0.97536, 0.735],
        ],
      },
    ],
  },
  "tamaki-drive-from-long-drive": {
    image:
      "/posts/0007-tamaki-drive-from-long-drive/then-tamaki-drive-from-long-drive.jpg",
    features: [
      {
        name: "Seawall sweeping in from left",
        points: [
          [0.0025, 0.59667],
          [0.1214, 0.57167],
          [0.23154, 0.54833],
          [0.34168, 0.525],
        ],
      },
      {
        name: "Seawall returning into bay",
        points: [
          [0.36671, 0.52],
          [0.4418, 0.50333],
          [0.51064, 0.49167],
          [0.53567, 0.48167],
        ],
      },
      {
        name: "Headland at the left of the bay",
        points: [
          [0.00125, 0.33333],
          [0.03004, 0.32],
          [0.05632, 0.315],
          [0.0826, 0.315],
          [0.10763, 0.31833],
          [0.14894, 0.32833],
        ],
      },
      {
        name: "Headland toe at the water",
        points: [
          [0.00375, 0.385],
          [0.02253, 0.39333],
          [0.07009, 0.39667],
          [0.11014, 0.39667],
        ],
      },
      {
        name: "Promenade edge on the bend",
        points: [
          [0.37171, 0.56167],
          [0.45432, 0.54167],
          [0.5194, 0.52167],
          [0.57822, 0.5],
          [0.60451, 0.485],
        ],
      },
      {
        name: "Inside curve of the old junction",
        points: [
          [0.29662, 0.995],
          [0.27534, 0.92833],
          [0.26783, 0.88],
          [0.27284, 0.83667],
          [0.28786, 0.79167],
          [0.31039, 0.75],
          [0.34293, 0.72167],
          [0.39299, 0.69167],
          [0.46934, 0.64],
        ],
      },
    ],
  },
  "northcote-post-office": {
    image: "/posts/0011-northcote-post-office/then-northcote-post-office.jpg",
    features: [
      {
        name: "Cornice across the front, left of pole",
        points: [
          [0.1325, 0.35616],
          [0.24125, 0.35616],
        ],
      },
      {
        name: "Front cornice towards corner",
        points: [
          [0.265, 0.35616],
          [0.355, 0.35812],
        ],
      },
      {
        name: "Tall left window and sill",
        points: [
          [0.12, 0.43249],
          [0.11875, 0.5499],
          [0.13, 0.5499],
        ],
      },
      {
        name: "Front window beside the pole",
        points: [
          [0.26875, 0.42466],
          [0.28875, 0.42466],
          [0.2875, 0.52642],
          [0.27, 0.52642],
        ],
      },
      {
        name: "Cornice along the side wing",
        points: [
          [0.47, 0.37378],
          [0.6375, 0.41683],
        ],
      },
      {
        name: "Side window group",
        points: [
          [0.53125, 0.44814],
          [0.53125, 0.55186],
        ],
      },
      {
        name: "Entrance porch gable",
        points: [
          [0.6325, 0.47358],
          [0.65, 0.41292],
          [0.67, 0.48141],
        ],
      },
      {
        name: "Roof hip above the corner",
        points: [
          [0.44125, 0.29354],
          [0.5275, 0.36008],
        ],
      },
    ],
  },
  "bridgeway-cinema": {
    image: "/posts/0010-bridgeway-cinema/then-bridgeway-cinema.jpg",
    features: [
      {
        name: "Gable at the right of the roof",
        region: "roof",
        points: [
          [0.71375, 0.22996],
          [0.7675, 0.11181],
        ],
      },
      {
        name: "Lower roof ridge behind the verandah",
        region: "roof",
        points: [
          [0.61625, 0.19831],
          [0.7125, 0.20253],
        ],
      },
      {
        name: "Top of the old verandah",
        points: [
          [0.00625, 0.41983],
          [0.70125, 0.2827],
          [0.98375, 0.30169],
        ],
      },
      {
        name: "Far left arched shop window",
        region: "shops",
        points: [
          [0.10625, 0.6308],
          [0.10625, 0.50633],
          [0.11375, 0.48945],
          [0.12875, 0.48101],
          [0.1425, 0.48734],
          [0.14875, 0.5],
        ],
      },
      {
        name: "Middle shop window arch",
        region: "shops",
        points: [
          [0.35375, 0.48734],
          [0.3625, 0.47046],
          [0.37875, 0.45781],
          [0.40125, 0.45359],
          [0.41625, 0.46203],
          [0.42375, 0.47679],
        ],
      },
      {
        name: "Middle shop window sill",
        region: "shops",
        points: [
          [0.35375, 0.64346],
          [0.4225, 0.64768],
        ],
      },
      {
        name: "Large right-hand shop arch",
        region: "shops",
        points: [
          [0.7775, 0.45148],
          [0.8, 0.43671],
          [0.8325, 0.42616],
          [0.865, 0.42616],
          [0.89875, 0.43671],
          [0.92625, 0.46203],
        ],
      },
      {
        name: "Outer shop pier and sill",
        region: "shops",
        points: [
          [0.93125, 0.47468],
          [0.93125, 0.66667],
          [0.78, 0.66034],
        ],
      },
    ],
  },
  "northcote-tavern": {
    image: "/posts/0012-northcote-tavern/then-northcote-tavern.jpg",
    features: [
      {
        name: "Left gable above Queen Street",
        region: "queen",
        points: [
          [0.29375, 0.2936],
          [0.3375, 0.21634],
          [0.375, 0.24062],
        ],
      },
      {
        name: "King Street gable to the right",
        region: "verandah",
        points: [
          [0.72, 0.37969],
          [0.76, 0.32671],
          [0.8025, 0.4128],
        ],
      },
      {
        name: "Main front gable",
        region: "queen",
        points: [
          [0.4175, 0.24503],
          [0.4925, 0.1766],
          [0.56125, 0.30684],
        ],
      },
      {
        name: "Corner where the two faces meet",
        region: "queen",
        points: [
          [0.41875, 0.29139],
          [0.41875, 0.70861],
        ],
      },
      {
        name: "Left pair of ground-floor windows",
        region: "queen",
        points: [
          [0.32375, 0.57174],
          [0.32375, 0.72185],
          [0.375, 0.72185],
          [0.375, 0.56071],
        ],
      },
      {
        name: "Upper verandah eaves",
        region: "verandah",
        points: [
          [0.54625, 0.31347],
          [0.70875, 0.38631],
        ],
      },
      {
        name: "Upper verandah rail",
        region: "verandah",
        points: [
          [0.54375, 0.49669],
          [0.7075, 0.53863],
        ],
      },
      {
        name: "Outer upstairs window",
        points: [
          [0.73375, 0.43267],
          [0.73375, 0.54084],
          [0.7625, 0.55408],
          [0.7625, 0.44371],
        ],
      },
    ],
  },
  "apirana-avenue-shops": {
    image: "/posts/0021-apirana-avenue-shops/then-apirana-avenue-shops.jpg",
    features: [
      {
        name: "High sawtooth roof and upright",
        region: "roof",
        points: [
          [0.28333, 0.40667],
          [0.48556, 0.34167],
          [0.48667, 0.44],
        ],
      },
      {
        name: "Clerestory roof receding to the right",
        region: "roof",
        points: [
          [0.49111, 0.37833],
          [0.60889, 0.41333],
        ],
      },
      {
        name: "Post office parapet, left of the lamp",
        region: "frontage",
        points: [
          [0.03222, 0.36833],
          [0.24222, 0.40667],
        ],
      },
      {
        name: "Post office parapet beyond the lamp",
        region: "frontage",
        points: [
          [0.26222, 0.41],
          [0.52667, 0.45833],
        ],
      },
      {
        name: "Verandah soffit beside the entrance",
        region: "frontage",
        points: [
          [0.01556, 0.50667],
          [0.21111, 0.52333],
        ],
      },
      {
        name: "Recessed shopfront jamb",
        points: [
          [0.01333, 0.56333],
          [0.01222, 0.73833],
        ],
      },
      {
        name: "Upper window at the far end",
        points: [
          [0.81444, 0.48167],
          [0.84111, 0.48833],
          [0.84111, 0.535],
          [0.81444, 0.52833],
          [0.81444, 0.48167],
        ],
      },
      {
        name: "Lamp shaft near the pavement end",
        points: [
          [0.25667, 0.165],
          [0.25, 0.465],
        ],
      },
      {
        name: "Curve at the end of the footpath",
        points: [
          [0.31444, 0.825],
          [0.30222, 0.87333],
          [0.28667, 0.925],
          [0.27778, 0.97167],
          [0.27444, 0.99667],
        ],
      },
    ],
  },
  "mayfair-place": {
    image: "/posts/0013-mayfair-place/then-mayfair-place.jpg",
    features: [
      {
        name: "Left bird, head and neck",
        points: [
          [0.20222, 0.13833],
          [0.19333, 0.10167],
          [0.18222, 0.065],
          [0.17, 0.05333],
          [0.16333, 0.05667],
          [0.15889, 0.075],
          [0.16, 0.09333],
          [0.17, 0.11167],
          [0.17778, 0.12667],
          [0.17889, 0.14333],
          [0.17444, 0.165],
          [0.16444, 0.18667],
        ],
      },
      {
        name: "Left bird, curved back to tail",
        points: [
          [0.16444, 0.18667],
          [0.13444, 0.195],
          [0.11333, 0.215],
          [0.09556, 0.24833],
          [0.08556, 0.28333],
          [0.08111, 0.30833],
        ],
      },
      {
        name: "Second bird, body above tail",
        points: [
          [0.18889, 0.18833],
          [0.19889, 0.21167],
          [0.21778, 0.255],
          [0.23889, 0.3],
          [0.25556, 0.32667],
        ],
      },
      {
        name: "Left shop parapet and corner",
        region: "shops",
        points: [
          [0.00222, 0.275],
          [0.05556, 0.3],
          [0.05333, 0.40833],
        ],
      },
      {
        name: "Left shop window sill",
        points: [
          [0.00222, 0.455],
          [0.04778, 0.46],
        ],
      },
      {
        name: "Pergola beam across the passage",
        region: "passage",
        points: [
          [0.41333, 0.54333],
          [0.50556, 0.54167],
        ],
      },
      {
        name: "Pergola post beside the opening",
        region: "passage",
        points: [
          [0.50556, 0.55],
          [0.50556, 0.625],
        ],
      },
      {
        name: "Far shop roof above the cafe",
        region: "shops",
        points: [
          [0.54444, 0.50167],
          [0.60778, 0.50167],
        ],
      },
      {
        name: "Front rim of the round stage",
        points: [
          [0.61444, 0.64833],
          [0.66, 0.655],
          [0.73111, 0.66],
          [0.82556, 0.66167],
          [0.88444, 0.65833],
          [0.92, 0.65167],
        ],
      },
      {
        name: "Play surface edge in foreground",
        points: [
          [0.37, 0.79167],
          [0.43444, 0.82],
          [0.49444, 0.865],
          [0.53111, 0.90833],
          [0.55667, 0.95333],
          [0.57333, 0.995],
        ],
      },
    ],
  },
  "bradley-lane-line-road": {
    image: "/posts/0014-bradley-lane-line-road/then-bradley-lane-line-road.jpg",
    // The mural wall a few metres away; the shopfronts and awnings down the street.
    zones: { near: [0, 0, 0.385, 0.83], far: [0.43, 0.05, 1, 0.75] },
    features: [
      {
        name: "Mural wall corner",
        region: "wall",
        // From below the DISCOUNTER sign that now covers the corner's top (2026): checked
        // there, a fitting corner read 4.6% off (19 Nov 2026).
        points: [
          [0.3955, 0.15],
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
        // The awning's own front is hidden behind its sign, and the sign was replaced (MoneyGram
        // in 2018, a deeper Hi Vape box by 2026), so the hanging TAKEAWAY sign, unchanged, marks
        // the awning instead (16 Nov 2026).
        name: "TAKEAWAY sign",
        region: "canopy",
        along: true,
        points: [
          [0.676, 0.41],
          [0.833, 0.41],
          [0.833, 0.457],
          [0.676, 0.457],
          [0.676, 0.41],
        ],
      },
      {
        name: "Shopfront base receding from wall corner",
        region: "shopfront",
        points: [
          [0.405, 0.811],
          [0.674, 0.687],
        ],
      },
      {
        name: "Shopfront window upright",
        region: "shopfront",
        points: [
          [0.626, 0.423],
          [0.624, 0.703],
        ],
      },
    ],
  },
  "tamaki-road-board-offices": {
    image:
      "/posts/0006-tamaki-road-board-offices/then-tamaki-road-board-offices.jpg",
    // St Heliers library today (19 Nov 2026): a large tree hides the left wing, the arch and the
    // front windows; the street became a roundabout and the 1929 buildings across it are gone.
    // Only what still shows takes part: the right roof and the corner and window of the right
    // facade. The kerb, the left wing's eaves and the horizon were dropped (now hidden or
    // rebuilt), and the base stays as a plain guide (benches and a hedge cover it).
    features: [
      {
        name: "Right roof ridge near frame edge",
        points: [
          [0.9, 0.21],
          [0.985, 0.215],
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
        name: "Building corner below the hip",
        region: "facade",
        points: [
          [0.849, 0.36],
          [0.849, 0.575],
        ],
      },
      {
        name: "Right edge window frame",
        region: "facade",
        points: [
          [0.947, 0.4],
          [0.947, 0.533],
          [0.982, 0.533],
          [0.982, 0.4],
          [0.947, 0.4],
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
