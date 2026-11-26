import type { Zones } from "@/lib/rephoto/parallax"

export const TRACE_OVERLAY_OPACITY = 0.16

// Editorial traces, tied to the exact uncropped archive. Coordinates are fractions
// of that image, not detections or a claim that the modern scene is unchanged.
export type ReferenceLines = {
  image: string
  // Visible archive composition, including edges obscured or rebuilt today.
  // These paths are drawn only. The matcher receives evidence from features.
  framing?: { name: string; points: [number, number][] }[]
  foreground?: string
  features: {
    name: string
    points: [number, number][]
    // Closest identifiable landmark to this corner of the subject.
    corner?: "upper-left" | "upper-right" | "lower-left" | "lower-right"
    region?: string
    // Its lettering pins it along its length too, so a sideways shift can be measured.
    along?: boolean
  }[]
  // Which part of the old photo is near and which far, for telling where to stand (parallax).
  zones?: Zones
}
const guides: Record<string, ReferenceLines> = {
  sheep: {
    image: "/posts/0001-sheep/then-sheep-4018x2298.jpg",
    framing: [
      {
        name: "Roof silhouette at right",
        points: [
          [0.505, 0.3567],
          [0.6, 0.2667],
          [0.6575, 0.3467],
          [0.7425, 0.3367],
        ],
      },
      {
        name: "Boundary down the hill",
        points: [
          [0.2225, 0.31],
          [0.3, 0.33],
          [0.4125, 0.3633],
          [0.5125, 0.3867],
        ],
      },
      {
        name: "Near house eaves down to the street",
        points: [
          [0.5175, 0.35],
          [0.5175, 0.4833],
          [0.555, 0.4967],
        ],
      },
      {
        name: "Roadside pole at the far left",
        points: [
          [0.0375, 0.1633],
          [0.0425, 0.4],
          [0.0475, 0.61],
        ],
      },
      {
        name: "Foundation and front step beside the street",
        points: [
          [0.6725, 0.54],
          [0.7225, 0.52],
          [0.75, 0.5233],
        ],
      },
    ],
    features: [
      {
        name: "Uphill power pole above the street corner",
        points: [
          [0.195, 0.1441],
          [0.19875, 0.13755],
          [0.205, 0.13755],
          [0.2075, 0.14847],
          [0.20125, 0.14847],
          [0.2025, 0.29039],
          [0.205, 0.41703],
        ],
      },
      {
        name: "Near kerb from foreground around street corner",
        points: [
          [0.0025, 0.80349],
          [0.065, 0.77511],
          [0.12625, 0.74454],
          [0.16625, 0.72271],
          [0.1825, 0.70961],
          [0.18625, 0.69869],
          [0.1825, 0.68996],
          [0.17125, 0.68341],
        ],
        corner: "lower-left",
      },
      {
        name: "Kerb returning up the side street",
        points: [
          [0.17125, 0.68341],
          [0.14125, 0.66812],
          [0.0975, 0.64192],
          [0.06, 0.6179],
          [0.005, 0.58515],
        ],
      },
      {
        name: "Distant ridgeline behind houses",
        points: [
          [0.015, 0.1533],
          [0.075, 0.1633],
          [0.13, 0.1933],
          [0.175, 0.2033],
        ],
        corner: "upper-left",
      },
      {
        name: "Far gable and end wall",
        points: [
          [0.8525, 0.36],
          [0.885, 0.3033],
          [0.915, 0.3467],
          [0.915, 0.51],
        ],
        corner: "upper-right",
      },
      {
        name: "Front step at the outer gable",
        points: [
          [0.8625, 0.5233],
          [0.91, 0.5233],
          [0.945, 0.5067],
          [0.9875, 0.5],
        ],
        corner: "lower-right",
      },
    ],
  },
  "mill-house": {
    image: "/posts/0000-mill-house/t1-mill-house-750x580.jpg",
    framing: [
      {
        name: "Left eave to front entrance",
        points: [
          [0.37, 0.4933],
          [0.3925, 0.49],
          [0.435, 0.4867],
          [0.465, 0.4833],
        ],
      },
      {
        name: "Right eave and outer gable",
        points: [
          [0.71, 0.5033],
          [0.7775, 0.5033],
          [0.795, 0.3767],
          [0.8125, 0.4833],
        ],
      },
      {
        name: "Foreground gate rails",
        points: [
          [0.27, 0.67],
          [0.3575, 0.6433],
          [0.455, 0.6433],
        ],
      },
      {
        name: "Gate across the lower frame",
        points: [
          [0.2725, 0.77],
          [0.36, 0.7933],
          [0.4475, 0.7267],
        ],
      },
      {
        name: "Left fence rail into the gate",
        points: [
          [0.0975, 0.67],
          [0.1575, 0.67],
          [0.23, 0.6733],
        ],
      },
      {
        name: "Right gatepost at the end of the rails",
        points: [
          [0.455, 0.64],
          [0.4775, 0.64],
          [0.4775, 0.75],
        ],
      },
      {
        name: "End of the right wing at the eave",
        points: [
          [0.795, 0.3767],
          [0.8125, 0.48],
          [0.805, 0.5033],
        ],
      },
    ],
    features: [
      {
        name: "Chimney above the left end of the ridge",
        points: [
          [0.41655, 0.3193],
          [0.41791, 0.29825],
          [0.42334, 0.29298],
          [0.43419, 0.29474],
          [0.43962, 0.30351],
          [0.43962, 0.31754],
        ],
        corner: "upper-left",
      },
      {
        name: "Right wing roof ridge above the low windows",
        points: [
          [0.69878, 0.38246],
          [0.74355, 0.38246],
          [0.7924, 0.3807],
        ],
        corner: "upper-right",
      },
      {
        name: "Main roof left slope and ridge",
        points: [
          [0.36771, 0.43509],
          [0.40706, 0.3193],
          [0.64722, 0.30877],
        ],
      },
      {
        name: "Main roof right gable",
        points: [
          [0.62958, 0.43333],
          [0.65129, 0.30877],
          [0.66893, 0.38421],
          [0.68657, 0.32456],
          [0.70014, 0.38246],
        ],
      },
      {
        name: "Left dormer gable and window",
        points: [
          [0.4152, 0.43158],
          [0.43555, 0.39123],
          [0.45726, 0.42632],
          [0.44369, 0.42807],
          [0.44369, 0.45614],
          [0.41791, 0.45965],
          [0.41791, 0.42982],
        ],
      },
      {
        name: "Middle dormer gable and opening",
        points: [
          [0.48168, 0.42982],
          [0.50746, 0.38947],
          [0.52646, 0.42456],
          [0.5156, 0.42632],
          [0.5156, 0.4614],
          [0.48711, 0.4614],
          [0.48711, 0.42632],
        ],
      },
      {
        name: "Right dormer gable and window",
        points: [
          [0.54545, 0.42982],
          [0.57531, 0.38772],
          [0.5943, 0.42632],
          [0.58209, 0.42807],
          [0.58209, 0.45965],
          [0.55224, 0.45965],
          [0.55224, 0.42982],
        ],
      },
      {
        name: "Gutter to the right of dormers",
        points: [
          [0.5848, 0.43158],
          [0.62687, 0.43333],
        ],
      },
      {
        name: "Veranda entrance gable",
        points: [
          [0.4654, 0.49298],
          [0.49254, 0.47193],
          [0.52239, 0.48772],
        ],
      },
      {
        name: "Left gatepost and fence junction",
        points: [
          [0.235, 0.6367],
          [0.235, 0.68],
          [0.235, 0.7633],
        ],
        corner: "lower-left",
      },
      {
        name: "Lower right wing window pair",
        points: [
          [0.7275, 0.5133],
          [0.7575, 0.5133],
          [0.7575, 0.55],
          [0.7275, 0.55],
          [0.7275, 0.5133],
        ],
        corner: "lower-right",
      },
    ],
  },
  "historic-post-office": {
    image:
      "/posts/0002-historic-helensville-post-office/post1-then-2003x1241.jpg",
    framing: [
      {
        name: "Outer roof and receding eaves",
        points: [
          [0.425, 0.3467],
          [0.4725, 0.33],
          [0.5075, 0.33],
          [0.53, 0.3167],
          [0.5925, 0.3133],
          [0.64, 0.3333],
          [0.7025, 0.3667],
        ],
      },
      {
        name: "Foreground road shoulder",
        points: [
          [0.375, 0.7533],
          [0.455, 0.78],
          [0.565, 0.83],
          [0.725, 0.9133],
        ],
      },
      {
        name: "Verandah fascia at the left margin",
        points: [
          [0.1425, 0.2633],
          [0.21, 0.2767],
          [0.29, 0.2933],
          [0.29, 0.3167],
          [0.145, 0.2967],
        ],
      },
      {
        name: "Fence panels to the right of the post office",
        points: [
          [0.7075, 0.5367],
          [0.755, 0.53],
          [0.85, 0.5233],
          [0.88, 0.5267],
        ],
      },
      {
        name: "Right fence return beyond the pole",
        points: [
          [0.9, 0.56],
          [0.9425, 0.5633],
          [0.9875, 0.5667],
        ],
      },
      {
        name: "Street gutter into the near foreground",
        points: [
          [0.3575, 0.7467],
          [0.41, 0.7633],
          [0.5025, 0.7933],
          [0.6025, 0.8533],
        ],
      },
    ],
    features: [
      {
        name: "Left masonry facade corner",
        points: [
          [0.425, 0.3498],
          [0.4275, 0.43874],
          [0.4275, 0.56917],
        ],
      },
      {
        name: "Parapet along front and side elevations",
        points: [
          [0.425, 0.3498],
          [0.48375, 0.33202],
        ],
      },
      {
        name: "Central parapet crown",
        points: [
          [0.4825, 0.33004],
          [0.485, 0.28656],
          [0.51875, 0.27866],
          [0.525, 0.31225],
        ],
        corner: "upper-left",
      },
      {
        name: "Upper cornice turning onto right wall",
        points: [
          [0.525, 0.31818],
          [0.57875, 0.3083],
          [0.605, 0.31818],
          [0.7025, 0.35771],
        ],
        corner: "upper-right",
      },
      {
        name: "Lower cornice and facade corner",
        points: [
          [0.52625, 0.35178],
          [0.58125, 0.34387],
          [0.60375, 0.3498],
          [0.705, 0.36561],
        ],
      },
      {
        name: "Centre gable and window",
        points: [
          [0.48125, 0.36364],
          [0.5025, 0.33992],
          [0.525, 0.35968],
        ],
      },
      {
        name: "Upper centre sash",
        points: [
          [0.4975, 0.37549],
          [0.5125, 0.37154],
          [0.5125, 0.42688],
          [0.4975, 0.42885],
          [0.4975, 0.37549],
        ],
      },
      {
        name: "Main arched entrance",
        points: [
          [0.49125, 0.56126],
          [0.49125, 0.49407],
          [0.49375, 0.47826],
          [0.50125, 0.46838],
          [0.50875, 0.46838],
          [0.5175, 0.47826],
          [0.52, 0.49012],
          [0.52, 0.55929],
        ],
      },
      {
        name: "Right front sash",
        points: [
          [0.545, 0.36759],
          [0.5625, 0.36364],
          [0.5625, 0.42292],
          [0.545, 0.42688],
          [0.545, 0.36759],
        ],
      },
      {
        name: "Front bay ledge over entrance",
        points: [
          [0.4775, 0.44664],
          [0.53375, 0.44071],
        ],
      },
      {
        name: "Left edge of the footpath under the verandah",
        points: [
          [0.0475, 0.6467],
          [0.055, 0.62],
          [0.0575, 0.55],
          [0.0575, 0.4867],
        ],
        corner: "lower-left",
      },
      {
        name: "Street edge past the building",
        points: [
          [0.2975, 0.5733],
          [0.41, 0.5733],
          [0.555, 0.5967],
          [0.705, 0.6233],
          [0.8725, 0.6533],
          [0.9925, 0.6733],
        ],
        corner: "lower-right",
      },
    ],
  },
  "mission-bay-fountain": {
    image: "/posts/0003-mission-bay-fountain/fountain-then-1080x885.jpg",
    framing: [
      {
        name: "Harbour horizon left of fountain",
        points: [
          [0.1825, 0.71],
          [0.2425, 0.70667],
          [0.29, 0.70667],
        ],
      },
      {
        name: "Harbour horizon at right edge",
        points: [
          [0.9225, 0.7],
          [0.9625, 0.7],
          [0.975, 0.7],
        ],
      },
      {
        name: "Left upper lip of the basin",
        points: [
          [0.0375, 0.75],
          [0.145, 0.75],
          [0.235, 0.7467],
          [0.28, 0.75],
        ],
      },
      {
        name: "Return of the outer rim at the right edge",
        points: [
          [0.875, 0.75],
          [0.9, 0.7467],
          [0.9125, 0.75],
          [0.92, 0.76],
          [0.91, 0.7767],
        ],
      },
      {
        name: "Paving against lawn below the basin",
        points: [
          [0.3025, 0.96],
          [0.3625, 0.9033],
          [0.4125, 0.8533],
          [0.4375, 0.8333],
        ],
      },
      {
        name: "Near paving corner at left",
        points: [
          [0.2125, 0.98],
          [0.2175, 0.9667],
          [0.2925, 0.9667],
        ],
      },
    ],
    features: [
      {
        name: "Front basin lip to plaque",
        points: [
          [0.03161, 0.76842],
          [0.14655, 0.77193],
          [0.28161, 0.77193],
        ],
      },
      {
        name: "Front basin lip curving around right end",
        points: [
          [0.40086, 0.77368],
          [0.55747, 0.77193],
          [0.71695, 0.76842],
          [0.8204, 0.76316],
          [0.88937, 0.75614],
          [0.91523, 0.75088],
        ],
      },
      {
        name: "Outer basin base on either side of curve",
        points: [
          [0.40086, 0.81404],
          [0.5546, 0.81404],
          [0.69397, 0.80877],
          [0.80603, 0.80351],
          [0.87644, 0.79649],
          [0.91379, 0.78772],
        ],
        corner: "lower-right",
      },
      {
        name: "Left basin base",
        points: [
          [0.03161, 0.80526],
          [0.14655, 0.81053],
          [0.28017, 0.81404],
        ],
        corner: "lower-left",
      },
      {
        name: "Front plaque surround",
        points: [
          [0.28161, 0.81404],
          [0.28448, 0.76667],
          [0.39799, 0.76667],
          [0.39943, 0.81404],
        ],
      },
      {
        name: "Raised central bowl",
        points: [
          [0.38649, 0.67719],
          [0.4023, 0.67018],
          [0.44397, 0.66842],
          [0.48994, 0.66842],
          [0.50718, 0.67368],
          [0.51006, 0.6807],
          [0.5, 0.68772],
          [0.39943, 0.69123],
          [0.38649, 0.67719],
        ],
        corner: "upper-left",
      },
      {
        name: "Central bowl pedestal",
        points: [
          [0.40086, 0.69123],
          [0.41092, 0.74912],
          [0.46552, 0.75263],
          [0.49282, 0.69123],
        ],
      },
      {
        name: "Volcanic skyline beyond fountain",
        points: [
          [0.54741, 0.68596],
          [0.59195, 0.67719],
          [0.62213, 0.66491],
          [0.64511, 0.65965],
          [0.65805, 0.6614],
          [0.67672, 0.67193],
          [0.68966, 0.66667],
          [0.70402, 0.67544],
        ],
        corner: "upper-right",
      },
    ],
  },
  "mission-bay-yacht-club": {
    image:
      "/posts/0004-mission-bay-yacht-club/then-mission-bay-yacht-club-1000x675.jpg",
    framing: [
      {
        name: "Open water beyond the seawall",
        points: [
          [0.6675, 0.46],
          [0.7025, 0.46],
        ],
      },
      {
        name: "Harbour horizon at right margin",
        points: [
          [0.9425, 0.4567],
          [0.9925, 0.4567],
        ],
      },
      {
        name: "Clubhouse outer gable and eaves",
        points: [
          [0.1225, 0.41],
          [0.145, 0.4],
          [0.1925, 0.4033],
          [0.1925, 0.4567],
        ],
      },
      {
        name: "Clubhouse base across the jetty",
        points: [
          [0.1525, 0.4767],
          [0.26, 0.48],
          [0.365, 0.4767],
        ],
      },
      {
        name: "Left corner of clubhouse entrance",
        points: [
          [0.1225, 0.4067],
          [0.1225, 0.4533],
          [0.1525, 0.4567],
        ],
      },
      {
        name: "Walkway paving joint near the left edge",
        points: [
          [0.0075, 0.93],
          [0.0525, 0.9267],
          [0.1175, 0.9267],
        ],
      },
      {
        name: "Next course across the near walkway",
        points: [
          [0.16, 0.9367],
          [0.2275, 0.9367],
          [0.2875, 0.93],
        ],
      },
      {
        name: "Seaward foot of the sloping wall",
        points: [
          [0.235, 0.6033],
          [0.2775, 0.6633],
          [0.3325, 0.7333],
          [0.3875, 0.8033],
          [0.4525, 0.87],
          [0.515, 0.9267],
        ],
      },
    ],
    features: [
      {
        name: "Walkway edge from clubhouse to foreground",
        points: [
          [0.125, 0.46667],
          [0.12, 0.51481],
          [0.10625, 0.58704],
          [0.0825, 0.69074],
          [0.0475, 0.83519],
          [0.00875, 0.98519],
        ],
        corner: "lower-left",
      },
      {
        name: "Beach side of seawall cap",
        points: [
          [0.13125, 0.46852],
          [0.155, 0.54259],
          [0.185, 0.62778],
          [0.21625, 0.72222],
          [0.2525, 0.82963],
          [0.3075, 0.99444],
        ],
        corner: "lower-right",
      },
      {
        name: "Clubhouse front roof",
        points: [
          [0.14, 0.38333],
          [0.17375, 0.32963],
          [0.21, 0.38519],
        ],
        corner: "upper-left",
      },
      {
        name: "Long roof ridge and outer hip",
        points: [
          [0.175, 0.32963],
          [0.34125, 0.34815],
          [0.37125, 0.38889],
        ],
      },
      {
        name: "Clubhouse window bank",
        points: [
          [0.25875, 0.41111],
          [0.33375, 0.41296],
          [0.33375, 0.43704],
          [0.25875, 0.43704],
          [0.25875, 0.41111],
        ],
      },
      {
        name: "Clubhouse above the sea wall",
        points: [
          [0.14, 0.45556],
          [0.2475, 0.45926],
          [0.35125, 0.45741],
        ],
      },
      {
        name: "Headland beyond the sails",
        points: [
          [0.75375, 0.43333],
          [0.78125, 0.41667],
          [0.81125, 0.40556],
          [0.84875, 0.4037],
          [0.87625, 0.41481],
        ],
        corner: "upper-right",
      },
      {
        name: "Sea below the headland between sails",
        points: [
          [0.75625, 0.46111],
          [0.865, 0.46111],
        ],
      },
    ],
  },
  "mission-house": {
    image: "/posts/0005-mission-house/mission-house-then-768x512.jpg",
    framing: [
      {
        name: "End wall to the rise at right",
        points: [
          [0.75, 0.5733],
          [0.8275, 0.55],
          [0.8925, 0.5233],
          [0.9475, 0.5],
        ],
      },
      {
        name: "Left skyline above roadside",
        points: [
          [0.005, 0.48],
          [0.04, 0.47],
          [0.07, 0.4633],
          [0.09, 0.4633],
        ],
      },
      {
        name: "Downhill wing chimney at left",
        points: [
          [0.2, 0.4567],
          [0.2025, 0.3567],
          [0.1975, 0.3467],
          [0.2125, 0.3367],
          [0.22, 0.34],
          [0.215, 0.45],
        ],
      },
      {
        name: "End of the right wing",
        points: [
          [0.8275, 0.45],
          [0.8425, 0.4533],
          [0.8425, 0.53],
        ],
      },
      {
        name: "Left wing lower masonry",
        points: [
          [0.02, 0.6],
          [0.0775, 0.5933],
          [0.13, 0.59],
        ],
      },
    ],
    features: [
      {
        name: "Left roof rising from the eaves",
        points: [
          [0.15234, 0.50977],
          [0.19922, 0.39453],
        ],
        corner: "upper-left",
      },
      {
        name: "Roof ridge beyond the chimney",
        points: [
          [0.22005, 0.38672],
          [0.3125, 0.35547],
          [0.42057, 0.32422],
        ],
      },
      {
        name: "Left roof gutter",
        points: [
          [0.23177, 0.50195],
          [0.31901, 0.49219],
          [0.38021, 0.48242],
        ],
      },
      {
        name: "Main gable from eave to eave",
        points: [
          [0.3763, 0.48438],
          [0.43229, 0.29297],
          [0.52083, 0.46875],
        ],
      },
      {
        name: "Chimney on main roof",
        points: [
          [0.51562, 0.31445],
          [0.51172, 0.24805],
          [0.53125, 0.24414],
          [0.54036, 0.35938],
        ],
      },
      {
        name: "Paired front window openings",
        points: [
          [0.41276, 0.48047],
          [0.4388, 0.47852],
          [0.4401, 0.53516],
          [0.41536, 0.53711],
          [0.41276, 0.48047],
        ],
      },
      {
        name: "Right gable and outer eaves",
        points: [
          [0.64583, 0.45312],
          [0.71094, 0.31641],
          [0.78255, 0.4375],
          [0.84245, 0.44336],
        ],
        corner: "upper-right",
      },
      {
        name: "Right roof ridge and side wall",
        points: [
          [0.71094, 0.31641],
          [0.79036, 0.34961],
          [0.84375, 0.44141],
          [0.84245, 0.54297],
        ],
      },
      {
        name: "Road edge from left foreground",
        points: [
          [0.005, 0.7267],
          [0.125, 0.6933],
          [0.2625, 0.6633],
          [0.42, 0.6267],
          [0.585, 0.6],
        ],
        corner: "lower-left",
      },
      {
        name: "Return kerb below the far gable",
        points: [
          [0.6875, 0.61],
          [0.6875, 0.62],
          [0.7, 0.6333],
          [0.74, 0.6433],
          [0.8125, 0.65],
          [0.9025, 0.6567],
          [0.9925, 0.6633],
        ],
        corner: "lower-right",
      },
    ],
  },
  "riddell-road-waimarie-street": {
    image:
      "/posts/0009-riddell-road-waimarie-street/then-riddell-road-waimarie-street.jpg",
    framing: [
      {
        name: "Distant skyline to the left",
        points: [
          [0.015, 0.46],
          [0.05, 0.46],
          [0.0775, 0.4667],
          [0.1075, 0.49],
          [0.1575, 0.5033],
        ],
      },
      {
        name: "Outer bank meets the road at right",
        points: [
          [0.645, 0.6133],
          [0.705, 0.6367],
          [0.78, 0.65],
          [0.8875, 0.6633],
          [0.995, 0.6733],
        ],
      },
      {
        name: "Shop wall against the outer bank",
        points: [
          [0.795, 0.4433],
          [0.795, 0.5433],
          [0.76, 0.5733],
        ],
      },
      {
        name: "Left entrance sill above the bank",
        points: [
          [0.01, 0.5567],
          [0.0575, 0.5533],
          [0.1075, 0.5467],
        ],
      },
      {
        name: "Inside of the foreground kerb at the bottom",
        points: [
          [0.605, 0.8833],
          [0.645, 0.9267],
          [0.6925, 0.9767],
          [0.71, 0.9967],
        ],
      },
    ],
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
        corner: "upper-left",
      },
      {
        name: "Left footpath approaching the junction",
        points: [
          [0.01335, 0.625],
          [0.06142, 0.61167],
          [0.11348, 0.595],
          [0.16689, 0.58333],
        ],
        corner: "lower-left",
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
        corner: "lower-right",
      },
      {
        name: "Top corner of the shop parapet",
        points: [
          [0.5925, 0.4467],
          [0.6625, 0.42],
          [0.725, 0.41],
          [0.725, 0.4267],
          [0.7975, 0.42],
        ],
        corner: "upper-right",
      },
    ],
  },
  "st-heliers-beach-gower-point": {
    image:
      "/posts/0008-st-heliers-beach-gower-point/then-st-heliers-beach-gower-point.jpg",
    foreground: "Curved stone rim below the palm",
    framing: [
      {
        name: "Horizon from last island to right border",
        points: [
          [0.8875, 0.5267],
          [0.9425, 0.5267],
          [0.9775, 0.5267],
        ],
      },
      {
        name: "Western slope towards the point",
        points: [
          [0.2325, 0.4433],
          [0.2525, 0.4433],
          [0.285, 0.4633],
          [0.3175, 0.4933],
        ],
      },
      {
        name: "Stone facing around the seaward bend",
        points: [
          [0.2415, 0.64162],
          [0.248, 0.6474],
          [0.2565, 0.65446],
          [0.2665, 0.66474],
          [0.2775, 0.67502],
          [0.2885, 0.68593],
          [0.2985, 0.69685],
        ],
      },
      {
        name: "Near end of the seawall",
        points: [
          [0.0975, 0.5867],
          [0.1425, 0.58],
          [0.14, 0.6033],
        ],
      },
      {
        name: "Lower paving edge beneath the stones",
        points: [
          [0.0225, 0.6733],
          [0.07, 0.6767],
          [0.135, 0.6867],
          [0.19, 0.6967],
          [0.24, 0.7067],
        ],
      },
      {
        name: "Land at the western end of the point",
        points: [
          [0.105, 0.5433],
          [0.145, 0.5433],
          [0.1825, 0.5333],
          [0.225, 0.5333],
        ],
      },
      {
        name: "Promenade lip to the right margin",
        points: [
          [0.8625, 0.72],
          [0.9125, 0.7267],
          [0.9525, 0.73],
          [0.9775, 0.7333],
        ],
      },
      {
        name: "Foot of the palm above the stone rim",
        points: [
          [0.0375, 0.6133],
          [0.05, 0.6067],
          [0.05, 0.56],
          [0.0525, 0.5033],
        ],
      },
    ],
    features: [
      {
        name: "Curved stone rim below the palm",
        region: "stonework",
        points: [
          [0.0175, 0.66089],
          [0.042, 0.6596],
          [0.0715, 0.65768],
          [0.0975, 0.65575],
          [0.1225, 0.65382],
          [0.147, 0.65189],
          [0.17, 0.64933],
          [0.191, 0.64676],
          [0.209, 0.64419],
          [0.2235, 0.64162],
          [0.2345, 0.63905],
          [0.2405, 0.63648],
          [0.2415, 0.63455],
          [0.239, 0.63263],
          [0.2325, 0.6307],
          [0.221, 0.62877],
          [0.208, 0.62749],
        ],
        corner: "lower-left",
      },
      {
        name: "Gower Point slope above the water",
        points: [
          [0.32036, 0.49833],
          [0.33852, 0.51167],
          [0.35798, 0.51833],
          [0.38003, 0.52167],
          [0.40597, 0.52833],
        ],
        corner: "upper-left",
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
        region: "offshore islands",
        points: [
          [0.77302, 0.52667],
          [0.79767, 0.52],
          [0.8275, 0.51333],
          [0.85084, 0.51167],
          [0.87678, 0.51667],
          [0.89364, 0.52333],
        ],
        corner: "upper-right",
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
        corner: "lower-right",
      },
    ],
  },
  "tamaki-drive-from-long-drive": {
    image:
      "/posts/0007-tamaki-drive-from-long-drive/then-tamaki-drive-from-long-drive.jpg",
    framing: [
      {
        name: "Far shore towards the vanishing point",
        points: [
          [0.1225, 0.4033],
          [0.2075, 0.4033],
          [0.3075, 0.41],
          [0.395, 0.4167],
          [0.46, 0.42],
        ],
      },
      {
        name: "Seaward edge below the left end of the promenade",
        points: [
          [0.005, 0.6667],
          [0.1025, 0.6367],
          [0.215, 0.6033],
          [0.3225, 0.5667],
        ],
      },
      {
        name: "Near kerb lip round the foreground turn",
        points: [
          [0.3125, 0.9933],
          [0.2875, 0.9233],
          [0.28, 0.8633],
          [0.285, 0.82],
          [0.31, 0.7733],
        ],
      },
      {
        name: "Roadside gable near the right edge",
        points: [
          [0.805, 0.4067],
          [0.8525, 0.35],
          [0.88, 0.3967],
          [0.88, 0.4367],
        ],
      },
      {
        name: "Distant seawall at the far left",
        points: [
          [0.005, 0.4067],
          [0.0475, 0.4067],
          [0.1025, 0.4067],
        ],
      },
    ],
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
        corner: "upper-left",
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
        corner: "lower-left",
      },
      {
        name: "Hills across the right of the bay",
        points: [
          [0.5675, 0.3367],
          [0.6125, 0.33],
          [0.65, 0.3133],
          [0.675, 0.3267],
          [0.7075, 0.33],
          [0.7475, 0.3133],
          [0.7775, 0.32],
        ],
        corner: "upper-right",
      },
      {
        name: "Outer road edge towards the houses",
        points: [
          [0.6375, 0.4667],
          [0.7325, 0.4867],
          [0.8275, 0.5033],
          [0.9325, 0.5167],
        ],
        corner: "lower-right",
      },
    ],
  },
  "northcote-post-office": {
    image: "/posts/0011-northcote-post-office/then-northcote-post-office.jpg",
    framing: [
      {
        name: "Outer corner below parapet",
        points: [
          [0.105, 0.3633],
          [0.1, 0.4733],
          [0.0975, 0.5433],
        ],
      },
      {
        name: "Far left roof and chimney beside post office",
        points: [
          [0.0075, 0.4767],
          [0.0625, 0.4733],
          [0.0625, 0.4433],
          [0.0725, 0.4367],
          [0.075, 0.47],
          [0.095, 0.4733],
        ],
      },
      {
        name: "Front window bank to the left of the pole",
        points: [
          [0.195, 0.4267],
          [0.195, 0.5267],
          [0.2475, 0.5267],
          [0.2475, 0.4267],
        ],
      },
      {
        name: "Outer porch post beneath gable",
        points: [
          [0.6575, 0.4967],
          [0.6575, 0.5433],
        ],
      },
      {
        name: "Street edge beyond the right of the crowd",
        points: [
          [0.6825, 0.73],
          [0.7425, 0.7233],
          [0.8075, 0.72],
        ],
      },
    ],
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
        corner: "lower-right",
      },
      {
        name: "Entrance porch gable",
        points: [
          [0.6325, 0.47358],
          [0.65, 0.41292],
          [0.67, 0.48141],
        ],
        corner: "upper-right",
      },
      {
        name: "Roof hip above the corner",
        points: [
          [0.44125, 0.29354],
          [0.5275, 0.36008],
        ],
      },
      {
        name: "Front roof silhouette behind parapet",
        points: [
          [0.275, 0.32667],
          [0.31, 0.30333],
          [0.3325, 0.29667],
          [0.3475, 0.28333],
          [0.3725, 0.28667],
          [0.405, 0.26],
          [0.4225, 0.27667],
          [0.4475, 0.29333],
          [0.47, 0.31],
          [0.5275, 0.36333],
        ],
        corner: "upper-left",
      },
      {
        name: "Street edge on the foreground diagonal",
        points: [
          [0.015, 0.7933],
          [0.1725, 0.7633],
          [0.3425, 0.74],
          [0.52, 0.72],
        ],
        corner: "lower-left",
      },
    ],
  },
  "bridgeway-cinema": {
    image: "/posts/0010-bridgeway-cinema/then-bridgeway-cinema.jpg",
    framing: [
      {
        name: "Verandah end at the right border",
        points: [
          [0.77, 0.3467],
          [0.895, 0.3533],
          [0.9925, 0.3533],
          [0.95, 0.3833],
        ],
      },
      {
        name: "Front kerb across the lower frame",
        points: [
          [0.01, 0.8],
          [0.1875, 0.84],
          [0.3575, 0.8867],
          [0.49, 0.9333],
          [0.6, 0.97],
        ],
      },
      {
        name: "Left end of the verandah fascia",
        points: [
          [0.0025, 0.43],
          [0.085, 0.4133],
          [0.1725, 0.3933],
          [0.175, 0.44],
          [0.1, 0.4533],
        ],
      },
      {
        name: "Near right verandah post to pavement",
        points: [
          [0.9425, 0.43],
          [0.9425, 0.61],
          [0.94, 0.6967],
        ],
      },
      {
        name: "End of right shop sill",
        points: [
          [0.78, 0.67],
          [0.845, 0.6667],
          [0.925, 0.6633],
        ],
      },
      {
        name: "Near kerb below the left shop entrance",
        points: [
          [0.005, 0.7867],
          [0.0725, 0.8],
          [0.145, 0.8233],
        ],
      },
    ],
    features: [
      {
        name: "Gable at the right of the roof",
        region: "roof",
        points: [
          [0.71375, 0.22996],
          [0.7675, 0.11181],
        ],
        corner: "upper-right",
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
        corner: "upper-left",
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
        corner: "lower-right",
      },
      {
        name: "Street edge below the arcade",
        points: [
          [0.005, 0.68],
          [0.1675, 0.7],
          [0.385, 0.72],
          [0.59, 0.7333],
          [0.7675, 0.7433],
          [0.9925, 0.75],
        ],
        corner: "lower-left",
      },
    ],
  },
  "northcote-tavern": {
    image: "/posts/0012-northcote-tavern/then-northcote-tavern.jpg",
    framing: [
      {
        name: "Left verandah rail and lower roof",
        points: [
          [0.15, 0.5767],
          [0.26, 0.5567],
          [0.41, 0.5133],
        ],
      },
      {
        name: "Fence and pavement across the right foreground",
        points: [
          [0.4175, 0.8167],
          [0.5675, 0.8367],
          [0.735, 0.86],
          [0.9, 0.9],
          [0.9725, 0.9233],
        ],
      },
      {
        name: "Lower edge of paling fence at right",
        points: [
          [0.8375, 0.8267],
          [0.895, 0.8433],
          [0.9025, 0.8433],
          [0.9025, 0.7667],
        ],
      },
      {
        name: "Left annex roof at the frame edge",
        points: [
          [0.0225, 0.6967],
          [0.1175, 0.6933],
          [0.1375, 0.6467],
          [0.1475, 0.6667],
        ],
      },
      {
        name: "Pavement below the near front corner",
        points: [
          [0.035, 0.8],
          [0.155, 0.8133],
          [0.28, 0.84],
          [0.42, 0.8567],
        ],
      },
    ],
    features: [
      {
        name: "Left gable above Queen Street",
        region: "queen",
        points: [
          [0.29375, 0.2936],
          [0.3375, 0.21634],
          [0.375, 0.24062],
        ],
        corner: "upper-left",
      },
      {
        name: "King Street gable to the right",
        region: "verandah",
        points: [
          [0.72, 0.37969],
          [0.76, 0.32671],
          [0.8025, 0.4128],
        ],
        corner: "upper-right",
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
      {
        name: "Left verandah edge and outer posts",
        points: [
          [0.145, 0.4433],
          [0.1525, 0.57],
          [0.155, 0.7867],
        ],
        corner: "lower-left",
      },
      {
        name: "Gate at the right end of the verandah",
        points: [
          [0.74, 0.77],
          [0.8225, 0.77],
          [0.8225, 0.83],
          [0.745, 0.8267],
          [0.74, 0.77],
        ],
        corner: "lower-right",
      },
    ],
  },
  "apirana-avenue-shops": {
    image: "/posts/0021-apirana-avenue-shops/then-apirana-avenue-shops.jpg",
    framing: [
      {
        name: "Right end of the upper shopfront",
        points: [
          [0.785, 0.45],
          [0.845, 0.45],
          [0.845, 0.5533],
        ],
      },
      {
        name: "Upper verandah from left frame edge",
        points: [
          [0.0025, 0.48],
          [0.12, 0.4933],
          [0.2375, 0.5033],
        ],
      },
      {
        name: "Lower kerb around the footpath end",
        points: [
          [0.3, 0.82],
          [0.285, 0.86],
          [0.2775, 0.92],
          [0.275, 0.9833],
        ],
      },
      {
        name: "Base of the near blue lamp beside the kerb",
        points: [
          [0.25, 0.68],
          [0.25, 0.75],
          [0.2475, 0.82],
          [0.2375, 0.82],
        ],
      },
      {
        name: "Outer wall of the right shop",
        points: [
          [0.995, 0.57],
          [0.9925, 0.65],
          [0.9725, 0.65],
        ],
      },
    ],
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
        corner: "upper-left",
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
      {
        name: "Farthest roof on the right margin",
        points: [
          [0.895, 0.5567],
          [0.925, 0.5167],
          [0.9925, 0.5167],
        ],
        corner: "upper-right",
      },
      {
        name: "Foot of the shopfront at left",
        points: [
          [0.005, 0.75],
          [0.0675, 0.74],
          [0.105, 0.7367],
        ],
        corner: "lower-left",
      },
      {
        name: "Recessed entrance at the far right",
        points: [
          [0.9125, 0.5767],
          [0.945, 0.5767],
          [0.945, 0.64],
        ],
        corner: "lower-right",
      },
    ],
  },
  "mayfair-place": {
    image: "/posts/0013-mayfair-place/then-mayfair-place.jpg",
    foreground: "Slide lip",
    framing: [
      {
        name: "Beam across the square passage",
        points: [
          [0.42, 0.54333],
          [0.4575, 0.54333],
          [0.495, 0.54333],
        ],
      },
      {
        name: "Roof above the far side of the square",
        points: [
          [0.6675, 0.50333],
          [0.725, 0.5],
          [0.7925, 0.49333],
        ],
      },
      {
        name: "Shop roof rising at the right border",
        points: [
          [0.9525, 0.41],
          [0.9725, 0.4],
          [0.995, 0.3967],
        ],
      },
      {
        name: "Outer rim of the brick path at bottom right",
        points: [
          [0.8375, 0.7667],
          [0.8075, 0.8233],
          [0.805, 0.8633],
          [0.815, 0.9067],
          [0.8425, 0.9567],
          [0.875, 0.9967],
        ],
      },
      {
        name: "Underside of left shop canopy",
        points: [
          [0.0025, 0.5033],
          [0.075, 0.51],
          [0.1325, 0.5133],
        ],
      },
    ],
    features: [
      {
        name: "Slide lip",
        corner: "lower-left",
        region: "slide",
        points: [
          [0, 0.75],
          [0.03889, 0.78167],
          [0.06556, 0.80167],
          [0.08333, 0.81],
          [0.1, 0.81167],
          [0.17222, 0.805],
          [0.18111, 0.80667],
          [0.18778, 0.81667],
        ],
      },
      {
        name: "Slide exit",
        points: [
          [0, 0.86833],
          [0.03667, 0.89],
          [0.07333, 0.905],
          [0.10111, 0.90667],
          [0.17444, 0.89667],
          [0.20111, 0.89167],
          [0.2, 0.86667],
          [0.19556, 0.85167],
        ],
      },
      {
        name: "Slide support",
        points: [
          [0.18556, 0.89833],
          [0.18556, 0.92833],
          [0.19333, 0.92833],
          [0.19333, 0.895],
        ],
      },
      {
        name: "Orange bench seat",
        points: [
          [0.23333, 0.72667],
          [0.28667, 0.72667],
          [0.37, 0.735],
          [0.44667, 0.745],
          [0.52778, 0.75167],
          [0.52667, 0.76],
          [0.49111, 0.76833],
          [0.41111, 0.75333],
          [0.33444, 0.74333],
          [0.23333, 0.73333],
          [0.23333, 0.72667],
        ],
      },
      {
        name: "Right bench foot",
        points: [
          [0.44667, 0.77333],
          [0.50444, 0.77],
          [0.5, 0.815],
          [0.47889, 0.82333],
          [0.45, 0.81833],
          [0.44667, 0.77333],
        ],
      },
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
        corner: "upper-left",
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
        name: "Right blue lamp shaft",
        region: "far lamp",
        points: [
          [0.73389, 0.44167],
          [0.73444, 0.53],
        ],
      },
      {
        name: "Central mast cap and side",
        region: "centre mast",
        points: [
          [0.36667, 0.40667],
          [0.36778, 0.28833],
          [0.37222, 0.285],
          [0.38, 0.28833],
          [0.37889, 0.43],
        ],
      },
      {
        name: "Right mast footing",
        region: "right mast",
        points: [
          [0.92222, 0.65667],
          [0.92444, 0.75333],
          [0.94778, 0.75667],
          [0.94667, 0.66],
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
        name: "Passage beam",
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
      {
        name: "High right mast against the sky",
        points: [
          [0.9, 0.0033],
          [0.9075, 0.1267],
          [0.915, 0.2867],
          [0.9225, 0.4333],
        ],
        corner: "upper-right",
      },
      {
        name: "Curve of outer planting bed",
        points: [
          [0.9975, 0.97667],
          [0.955, 0.93667],
          [0.9175, 0.89],
          [0.8875, 0.84],
          [0.8625, 0.79333],
          [0.8525, 0.77333],
        ],
        corner: "lower-right",
      },
    ],
  },
  "bradley-lane-line-road": {
    image: "/posts/0014-bradley-lane-line-road/then-bradley-lane-line-road.jpg",
    // The mural wall a few metres away; the shopfronts and awnings down the street.
    zones: { near: [0, 0, 0.385, 0.83], far: [0.43, 0.05, 1, 0.75] },
    framing: [
      {
        name: "Sloping roof silhouette at top of frame",
        points: [
          [0.4725, 0],
          [0.6225, 0.17],
        ],
      },
      {
        name: "Receding canopy underside",
        points: [
          [0.4125, 0.3167],
          [0.5225, 0.3533],
          [0.6225, 0.3833],
          [0.675, 0.3933],
        ],
      },
      {
        name: "Far end of canopy at street edge",
        points: [
          [0.865, 0.29],
          [0.8975, 0.45],
          [0.9025, 0.48333],
        ],
      },
      {
        name: "Far skyline beyond the canopy",
        points: [
          [0.915, 0.48333],
          [0.93, 0.49],
          [0.9425, 0.5],
          [0.9575, 0.49],
          [0.975, 0.49333],
          [0.995, 0.48],
        ],
      },
      {
        name: "Painted canyon ledge at far left",
        points: [
          [0.005, 0.6967],
          [0.045, 0.68],
          [0.05, 0.5933],
          [0.08, 0.5833],
          [0.12, 0.5667],
        ],
      },
      {
        name: "Left end of the low mural seam",
        points: [
          [0.0025, 0.7267],
          [0.07, 0.73],
          [0.125, 0.7333],
          [0.17, 0.7333],
        ],
      },
      {
        name: "Outer lower edge of the tactile paving",
        points: [
          [0.5125, 0.84],
          [0.61, 0.85],
          [0.7325, 0.8633],
          [0.805, 0.8733],
        ],
      },
    ],
    features: [
      {
        name: "Mural wall corner",
        region: "wall",
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
        corner: "upper-left",
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
        corner: "lower-left",
      },
      {
        name: "TAKEAWAY sign",
        corner: "upper-right",
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
      {
        name: "Base of the outer canopy post",
        points: [
          [0.885, 0.5033],
          [0.885, 0.59],
          [0.8825, 0.66],
          [0.8975, 0.66],
          [0.9, 0.51],
        ],
        corner: "lower-right",
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
    framing: [
      {
        name: "Left wing roof and outer eave",
        points: [
          [0.533, 0.3678],
          [0.552, 0.3584],
          [0.583, 0.3302],
          [0.607, 0.3067],
        ],
      },
      {
        name: "Left wing eave and outer wall",
        points: [
          [0.534, 0.3709],
          [0.557, 0.3725],
          [0.604, 0.3631],
        ],
      },
      {
        name: "Left wall from eave to foot",
        points: [
          [0.553, 0.3756],
          [0.552, 0.5587],
        ],
      },
      {
        name: "Entrance arch opening",
        points: [
          [0.621, 0.5524],
          [0.621, 0.3693],
          [0.623, 0.3505],
          [0.628, 0.3333],
          [0.634, 0.3208],
          [0.64, 0.3286],
          [0.646, 0.349],
          [0.651, 0.3756],
          [0.652, 0.5524],
        ],
      },
      {
        name: "Entrance right pier and front roof junction",
        points: [
          [0.687, 0.5603],
          [0.688, 0.3505],
          [0.711, 0.3318],
          [0.735, 0.3099],
          [0.752, 0.2879],
        ],
      },
      {
        name: "Roof ridge approaching from the entrance",
        points: [
          [0.751, 0.2535],
          [0.811, 0.2332],
          [0.89, 0.2097],
        ],
      },
      {
        name: "Street edge across the lower right",
        points: [
          [0.311, 0.5759],
          [0.392, 0.6088],
          [0.549, 0.6604],
          [0.674, 0.7011],
          [0.836, 0.7637],
          [0.998, 0.82],
        ],
      },
      {
        name: "Distant street skyline on the left",
        points: [
          [0.172, 0.3584],
          [0.214, 0.3255],
          [0.257, 0.3192],
          [0.273, 0.302],
          [0.306, 0.277],
          [0.329, 0.2942],
          [0.348, 0.2911],
        ],
      },
      {
        name: "Far left shop parapet beside the tram",
        points: [
          [0.155, 0.3833],
          [0.2, 0.35],
          [0.24, 0.34],
          [0.2725, 0.3433],
        ],
      },
      {
        name: "Top of the neighboring brick wall",
        points: [
          [0.3975, 0.43],
          [0.475, 0.43],
          [0.54, 0.43],
        ],
      },
      {
        name: "Right wing bottom window recess",
        points: [
          [0.725, 0.5233],
          [0.745, 0.5233],
          [0.745, 0.3967],
          [0.7325, 0.4],
        ],
      },
      {
        name: "Kerb return beneath the entrance",
        points: [
          [0.5875, 0.68],
          [0.62, 0.6867],
          [0.66, 0.68],
        ],
      },
      {
        name: "Road shoulder toward the bottom right",
        points: [
          [0.7725, 0.78],
          [0.85, 0.8233],
          [0.9375, 0.8633],
          [0.995, 0.89],
        ],
      },
    ],
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
        corner: "upper-right",
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
        corner: "lower-right",
      },
      {
        name: "Entrance parapet and roof behind it",
        points: [
          [0.609, 0.3036],
          [0.613, 0.266],
          [0.638, 0.2535],
          [0.664, 0.252],
          [0.666, 0.2629],
          [0.694, 0.2645],
          [0.75, 0.2645],
        ],
        corner: "upper-left",
      },
      {
        name: "Base of the left wing and entry",
        points: [
          [0.549, 0.5634],
          [0.578, 0.5728],
          [0.606, 0.5806],
          [0.651, 0.5884],
          [0.688, 0.5962],
        ],
        corner: "lower-left",
      },
    ],
  },
  "civic-theatre": {
    image: "/posts/0015-civic-theatre/then-civic-theatre.jpg",
    framing: [
      {
        name: "West edge of the theatre front",
        points: [
          [0.0475, 0.2067],
          [0.045, 0.3767],
          [0.045, 0.51],
          [0.045, 0.5367],
        ],
      },
      {
        name: "Far side of the marquee",
        points: [
          [0.745, 0.5],
          [0.8525, 0.51],
          [0.96, 0.5167],
        ],
      },
      {
        name: "Kerb around the full theatre corner",
        points: [
          [0.1625, 0.7133],
          [0.28, 0.7267],
          [0.425, 0.7333],
          [0.5275, 0.7333],
          [0.6675, 0.7267],
          [0.81, 0.71],
          [0.955, 0.6933],
        ],
      },
      {
        name: "Pavement kerb under the left end of the foyer",
        points: [
          [0.065, 0.6967],
          [0.1175, 0.7067],
          [0.1625, 0.7133],
        ],
      },
      {
        name: "Rail groove bending across the right foreground",
        points: [
          [0.8225, 0.7467],
          [0.7875, 0.77],
          [0.78, 0.79],
          [0.79, 0.81],
          [0.8325, 0.8333],
        ],
      },
      {
        name: "Upper cornice above left side screens",
        points: [
          [0.05, 0.16],
          [0.1125, 0.1233],
          [0.1725, 0.0933],
          [0.23, 0.0667],
        ],
      },
    ],
    features: [
      {
        name: "Right canopy edge from entrance",
        points: [
          [0.74571, 0.50275],
          [0.80857, 0.50092],
          [0.88143, 0.50459],
          [0.96143, 0.51376],
        ],
      },
      {
        name: "Left canopy edge rising to the entrance",
        points: [
          [0.04571, 0.55413],
          [0.13143, 0.54128],
          [0.25857, 0.52477],
          [0.39, 0.51009],
          [0.48286, 0.50459],
        ],
      },
      {
        name: "Central arch over the entrance",
        points: [
          [0.48286, 0.50642],
          [0.50571, 0.47156],
          [0.53571, 0.44404],
          [0.56286, 0.42569],
          [0.59714, 0.41651],
          [0.62714, 0.41468],
          [0.65714, 0.42202],
          [0.68857, 0.43853],
          [0.71571, 0.46055],
          [0.74429, 0.50459],
        ],
      },
      {
        name: "Leftmost lattice screen",
        region: "left",
        points: [
          [0.14, 0.135],
          [0.14, 0.41],
        ],
        corner: "upper-left",
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
        corner: "upper-right",
      },
      {
        name: "Left entrance door jamb below the canopy",
        points: [
          [0.19, 0.55],
          [0.19, 0.67],
          [0.2075, 0.6733],
        ],
        corner: "lower-left",
      },
      {
        name: "Far right bay below the marquee",
        points: [
          [0.91, 0.55],
          [0.945, 0.5533],
          [0.945, 0.6533],
        ],
        corner: "lower-right",
      },
    ],
  },
  "st-matthew-in-the-city": {
    image: "/posts/0016-st-matthew-in-the-city/then-st-matthew-in-the-city.jpg",
    framing: [
      {
        name: "Roofline from tower to east gable",
        points: [
          [0.36, 0.5433],
          [0.4075, 0.5],
          [0.475, 0.4533],
          [0.5625, 0.4],
          [0.6, 0.38],
        ],
      },
      {
        name: "Far roof beyond the east gable",
        points: [
          [0.7875, 0.61],
          [0.865, 0.61],
          [0.9725, 0.5833],
        ],
      },
      {
        name: "Street edge across the church frontage",
        points: [
          [0.025, 0.9],
          [0.2, 0.89],
          [0.4225, 0.87],
          [0.62, 0.8567],
          [0.7875, 0.8467],
          [0.965, 0.8333],
        ],
      },
      {
        name: "Far left building roof at the tower foot",
        points: [
          [0.0225, 0.7967],
          [0.065, 0.7933],
          [0.1175, 0.7933],
          [0.145, 0.8133],
          [0.1825, 0.82],
        ],
      },
      {
        name: "Roof of the low wing to the far right",
        points: [
          [0.7875, 0.6267],
          [0.8425, 0.6367],
          [0.915, 0.6167],
          [0.9675, 0.6],
        ],
      },
    ],
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
        corner: "upper-left",
      },
      {
        name: "East gable",
        region: "east",
        points: [
          [0.651, 0.417],
          [0.696, 0.324],
          [0.743, 0.408],
        ],
        corner: "upper-right",
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
      {
        name: "Tower base at the left end",
        points: [
          [0.1925, 0.86],
          [0.1925, 0.8833],
          [0.245, 0.88],
          [0.305, 0.87],
        ],
        corner: "lower-left",
      },
      {
        name: "Lower right church doorway",
        points: [
          [0.74, 0.8433],
          [0.74, 0.7867],
          [0.75, 0.7633],
          [0.76, 0.7767],
          [0.765, 0.8],
          [0.765, 0.84],
        ],
        corner: "lower-right",
      },
    ],
  },
  "auckland-art-gallery": {
    image: "/posts/0017-auckland-art-gallery/then-auckland-art-gallery.jpg",
    framing: [
      {
        name: "Right wing receding roof",
        points: [
          [0.7525, 0.45333],
          [0.775, 0.50333],
          [0.7975, 0.49333],
          [0.805, 0.54667],
          [0.86, 0.54333],
          [0.8875, 0.6],
          [0.895, 0.63333],
          [0.925, 0.66333],
        ],
      },
      {
        name: "Ground line on both sides of tower",
        points: [
          [0.19, 0.8067],
          [0.41, 0.8267],
          [0.56, 0.8433],
          [0.68, 0.84],
          [0.925, 0.82],
        ],
      },
      {
        name: "Footpath kerb below the left pavilion",
        points: [
          [0.03, 0.9167],
          [0.1525, 0.9067],
          [0.2575, 0.8933],
          [0.3825, 0.8833],
        ],
      },
      {
        name: "Eave return on the far right",
        points: [
          [0.8525, 0.6],
          [0.89, 0.63],
          [0.92, 0.6467],
        ],
      },
    ],
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
      {
        name: "Left pavilion gable above the arches",
        points: [
          [0.1925, 0.5367],
          [0.2275, 0.46],
          [0.2525, 0.41],
          [0.2775, 0.4633],
          [0.305, 0.5167],
        ],
        corner: "upper-left",
      },
      {
        name: "Tower cupola and lantern",
        points: [
          [0.575, 0.22333],
          [0.5875, 0.22],
          [0.5925, 0.19],
          [0.61, 0.17],
          [0.6175, 0.16333],
          [0.6225, 0.14333],
          [0.63, 0.16],
          [0.64, 0.16333],
          [0.66, 0.18333],
          [0.6625, 0.21],
        ],
        corner: "upper-right",
      },
      {
        name: "Twin entrance arches at the far left",
        points: [
          [0.185, 0.8067],
          [0.185, 0.76],
          [0.1925, 0.74],
          [0.2025, 0.73],
          [0.215, 0.7433],
          [0.2175, 0.7667],
          [0.2175, 0.8067],
        ],
        corner: "lower-left",
      },
      {
        name: "Far right corner down to the pavement",
        points: [
          [0.9225, 0.6633],
          [0.9275, 0.6667],
          [0.9275, 0.8267],
          [0.9025, 0.83],
        ],
        corner: "lower-right",
      },
    ],
  },
  "ferry-building": {
    image: "/posts/0018-ferry-building/then-ferry-building.jpg",
    framing: [
      {
        name: "Clock tower cap",
        points: [
          [0.59, 0.3567],
          [0.6025, 0.3233],
          [0.6175, 0.2833],
          [0.625, 0.26],
          [0.635, 0.28],
          [0.665, 0.3567],
        ],
      },
      {
        name: "Long roof above receding facade",
        points: [
          [0.51, 0.4833],
          [0.5725, 0.5133],
          [0.6175, 0.5467],
          [0.69, 0.59],
          [0.7425, 0.62],
        ],
      },
      {
        name: "Distant wharf roof on the far left",
        points: [
          [0.025, 0.74],
          [0.1125, 0.7367],
          [0.12, 0.7533],
        ],
      },
      {
        name: "Quayside at the lower right",
        points: [
          [0.5125, 0.8567],
          [0.6275, 0.8567],
          [0.745, 0.85],
          [0.83, 0.8533],
        ],
      },
      {
        name: "Arch above the first ground floor bay",
        points: [
          [0.3425, 0.8133],
          [0.345, 0.7967],
          [0.3525, 0.7833],
          [0.3625, 0.78],
          [0.3725, 0.7933],
          [0.375, 0.81],
        ],
      },
      {
        name: "Far wharf roof below the right facade",
        points: [
          [0.7525, 0.7867],
          [0.8, 0.7867],
          [0.83, 0.7867],
        ],
      },
      {
        name: "Outer edge of wharf approach at the left",
        points: [
          [0.0325, 0.8367],
          [0.1175, 0.8367],
          [0.185, 0.8367],
        ],
      },
      {
        name: "Lower sill across the right end bays",
        points: [
          [0.66, 0.77],
          [0.7, 0.78],
          [0.7375, 0.79],
        ],
      },
    ],
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
        corner: "upper-left",
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
        corner: "lower-left",
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
        corner: "lower-right",
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
        corner: "upper-right",
      },
    ],
  },
  "chief-post-office": {
    image: "/posts/0019-chief-post-office/then-chief-post-office.jpg",
    framing: [
      {
        name: "Outer building corner at the far left",
        points: [
          [0.09, 0.5333],
          [0.09, 0.7567],
        ],
      },
      {
        name: "Lower street edge across the frame",
        points: [
          [0.03, 0.8333],
          [0.3425, 0.87],
          [0.6525, 0.92],
          [0.95, 0.96],
        ],
      },
      {
        name: "Top of the far left roof",
        points: [
          [0.0875, 0.52],
          [0.155, 0.4667],
          [0.17, 0.4567],
          [0.2025, 0.4633],
        ],
      },
      {
        name: "Upper arcade to the right border",
        points: [
          [0.82, 0.49],
          [0.87, 0.4767],
          [0.9225, 0.4633],
          [0.9625, 0.45],
        ],
      },
    ],
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
        corner: "upper-left",
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
      {
        name: "Upper cornice entering at the right edge",
        points: [
          [0.8175, 0.27],
          [0.8625, 0.24],
          [0.925, 0.2],
          [0.965, 0.16],
        ],
        corner: "upper-right",
      },
      {
        name: "Base of the leftmost bay",
        points: [
          [0.0975, 0.7467],
          [0.0975, 0.7733],
          [0.155, 0.7733],
          [0.1975, 0.7833],
        ],
        corner: "lower-left",
      },
      {
        name: "Right entrance bay at pavement level",
        points: [
          [0.8375, 0.82],
          [0.8375, 0.7367],
          [0.8425, 0.7167],
          [0.8525, 0.7033],
          [0.865, 0.6967],
          [0.875, 0.7067],
          [0.8825, 0.73],
        ],
        corner: "lower-right",
      },
    ],
  },
  customhouse: {
    image: "/posts/0020-customhouse/then-customhouse.jpg",
    framing: [
      {
        name: "Roof silhouette across central tower",
        points: [
          [0.525, 0.41],
          [0.5225, 0.35],
          [0.535, 0.32333],
          [0.5375, 0.27333],
          [0.555, 0.24333],
          [0.5725, 0.19333],
          [0.5725, 0.17333],
          [0.59, 0.16333],
          [0.615, 0.17],
          [0.6125, 0.19],
          [0.6375, 0.22],
          [0.6575, 0.27],
          [0.665, 0.29667],
        ],
      },
      {
        name: "Right end cornice and pavement",
        points: [
          [0.92, 0.6333],
          [0.92, 0.8367],
          [0.9475, 0.8333],
        ],
      },
      {
        name: "Lower sill at the right pavilion",
        points: [
          [0.8225, 0.8067],
          [0.8725, 0.81],
          [0.905, 0.8067],
        ],
      },
      {
        name: "Roadside kerb beyond the lamp",
        points: [
          [0.755, 0.9067],
          [0.8175, 0.9133],
          [0.89, 0.9233],
          [0.9475, 0.9267],
        ],
      },
      {
        name: "Front cornice into the outer right bay",
        points: [
          [0.785, 0.5033],
          [0.86, 0.5133],
          [0.91, 0.5233],
        ],
      },
    ],
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
        corner: "upper-right",
      },
      {
        name: "Albert Street corner",
        region: "right",
        points: [
          [0.921, 0.49],
          [0.921, 0.83],
        ],
        corner: "lower-right",
      },
      {
        name: "Left bay roof and end wall",
        points: [
          [0.055, 0.4367],
          [0.0575, 0.3867],
          [0.0775, 0.3367],
          [0.185, 0.36],
        ],
        corner: "upper-left",
      },
      {
        name: "Foot of the left entrance bay",
        points: [
          [0.1025, 0.8833],
          [0.1, 0.79],
          [0.1675, 0.7867],
          [0.1675, 0.8767],
        ],
        corner: "lower-left",
      },
    ],
  },
}
export function referenceLines(slug: string, image: string) {
  const guide = guides[slug]
  return guide?.image === image ? guide : null
}
