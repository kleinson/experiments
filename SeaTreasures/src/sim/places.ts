import photoColours from '../../data/place-colours.json' with { type: 'json' }
import type { Rgb } from './patterns.ts'

/**
 * What the sea floor looks like at each place: its reef, sand, rock, plants,
 * water and fish. Each profile names the sourced fact it rests on (claims in
 * data/research/places.json); shapes and colours are illustrations of that
 * character, not a survey, and the scenery says so.
 */
export type Reef =
  | 'coral-triangle'
  | 'indo-pacific'
  | 'red-sea'
  | 'atoll'
  | 'granite'
  | 'volcanic'
  | 'caribbean'
  | 'caribbean-seagrass'
  | 'pink-sand'
  | 'rocky-algae'
  | 'posidonia'
  | 'shallow-gulf'

/** Coral forms, weighted per reef: branching, massive (brain), table, fan, soft, elkhorn. */
export type CoralForms = {
  branching: number
  massive: number
  table: number
  fan: number
  soft: number
  elkhorn: number
}

export type PlaceLook = {
  reef: Reef
  /** One line the setting note shows. */
  note: string
  /** The claim the note rests on. */
  claim: string
  sand: Rgb
  rock: Rgb[]
  /** How much living coral there is, 0–1, and its forms and colours. */
  coral: number
  forms: CoralForms
  palette: Rgb[]
  /** Extra beds this place adds to the species' habitat. */
  beds: Partial<
    Record<'coral' | 'rubble' | 'sand' | 'seagrass' | 'kelp' | 'rock', number>
  >
  grass: 'turtle' | 'posidonia' | 'generic'
  /** Water colour in shallow, clear daylight, and how clear it is (1 = very clear). */
  water: Rgb
  clarity: number
  /** The water's colour cast at about 8 m, per channel 0–1, measured from photos. */
  cast?: [number, number, number]
  /** A school of fish: colour and how many. */
  fish: { colour: Rgb; count: number; stripe?: Rgb }
}

const indoPalette: Rgb[] = [
  [150, 104, 70],
  [190, 140, 86],
  [128, 92, 128],
  [112, 128, 82],
  [204, 120, 96],
  [222, 182, 108],
  [176, 96, 116],
  [90, 120, 140],
]
const caribPalette: Rgb[] = [
  [196, 150, 84],
  [170, 128, 70],
  [138, 108, 64],
  [150, 90, 140],
  [120, 70, 130],
  [210, 176, 110],
]
const forms = (f: Partial<CoralForms>): CoralForms => ({
  branching: 0,
  massive: 0,
  table: 0,
  fan: 0,
  soft: 0,
  elkhorn: 0,
  ...f,
})

const profiles: Record<Reef, Omit<PlaceLook, 'reef'>> = {
  'coral-triangle': {
    note: 'The Coral Triangle holds at least 500 reef-building coral species per ecoregion',
    claim: 'place-coral-triangle',
    sand: [226, 216, 194],
    rock: [[150, 140, 126]],
    coral: 1,
    forms: forms({
      branching: 0.3,
      massive: 0.2,
      table: 0.2,
      fan: 0.1,
      soft: 0.2,
    }),
    palette: indoPalette,
    beds: { coral: 0.5, rubble: 0.15 },
    grass: 'generic',
    water: [40, 140, 176],
    clarity: 0.8,
    fish: { colour: [240, 140, 60], count: 16, stripe: [250, 250, 250] },
  },
  'indo-pacific': {
    note: 'Indo-Pacific reefs are built by Acropora, including table corals',
    claim: 'place-acropora',
    sand: [232, 222, 198],
    rock: [[160, 150, 134]],
    coral: 0.85,
    forms: forms({
      branching: 0.3,
      massive: 0.25,
      table: 0.3,
      fan: 0.05,
      soft: 0.1,
    }),
    palette: indoPalette,
    beds: { coral: 0.4, rubble: 0.1 },
    grass: 'generic',
    water: [44, 150, 182],
    clarity: 0.85,
    fish: { colour: [70, 120, 220], count: 14 },
  },
  'red-sea': {
    note: 'Some of the healthiest reefs in the world, with over 200 kinds of soft and hard coral',
    claim: 'place-red-sea',
    sand: [236, 224, 198],
    rock: [[176, 160, 136]],
    coral: 1,
    forms: forms({
      branching: 0.25,
      massive: 0.2,
      table: 0.15,
      fan: 0.15,
      soft: 0.25,
    }),
    palette: [...indoPalette, [220, 90, 140], [240, 150, 70]],
    beds: { coral: 0.5 },
    grass: 'generic',
    water: [30, 120, 190],
    clarity: 1,
    fish: { colour: [250, 150, 40], count: 18 },
  },
  atoll: {
    note: 'Low-lying atolls set around lagoons: white coral sand and scattered coral heads',
    claim: 'place-atoll',
    sand: [244, 238, 222],
    rock: [[200, 194, 178]],
    coral: 0.55,
    forms: forms({ branching: 0.35, massive: 0.4, table: 0.2, soft: 0.05 }),
    palette: indoPalette,
    beds: { sand: 0.5, coral: 0.2 },
    grass: 'generic',
    water: [60, 190, 200],
    clarity: 1,
    fish: { colour: [250, 220, 70], count: 12 },
  },
  granite: {
    note: 'The Seychelles sit on a submerged granite block: rounded granite boulders among the coral',
    claim: 'place-seychelles-granite',
    sand: [236, 226, 204],
    rock: [
      [168, 150, 136],
      [146, 128, 118],
      [186, 170, 154],
    ],
    coral: 0.6,
    forms: forms({ branching: 0.3, massive: 0.3, table: 0.2, soft: 0.2 }),
    palette: indoPalette,
    beds: { rock: 0.7, coral: 0.2 },
    grass: 'generic',
    water: [44, 156, 186],
    clarity: 0.9,
    fish: { colour: [70, 120, 220], count: 12 },
  },
  volcanic: {
    note: 'A volcanic island: dark basalt boulders, darker sand, corals growing on the lava',
    claim: 'place-volcanic',
    sand: [176, 166, 150],
    rock: [
      [62, 60, 60],
      [80, 76, 74],
      [96, 90, 86],
    ],
    coral: 0.6,
    forms: forms({ branching: 0.25, massive: 0.55, soft: 0.1, table: 0.1 }),
    palette: [
      [150, 140, 90],
      [130, 110, 80],
      [170, 150, 110],
      [110, 120, 90],
    ],
    beds: { rock: 0.8 },
    grass: 'generic',
    water: [30, 110, 170],
    clarity: 0.95,
    fish: { colour: [70, 120, 220], count: 10 },
  },
  caribbean: {
    note: 'Caribbean reefs: branching elkhorn coral, sea fans and turtle-grass meadows in between',
    claim: 'place-caribbean',
    sand: [236, 228, 208],
    rock: [[176, 166, 146]],
    coral: 0.8,
    forms: forms({ elkhorn: 0.3, massive: 0.3, fan: 0.3, branching: 0.1 }),
    palette: caribPalette,
    beds: { coral: 0.35, seagrass: 0.3 },
    grass: 'turtle',
    water: [40, 160, 186],
    clarity: 0.9,
    fish: { colour: [120, 90, 200], count: 12, stripe: [240, 210, 60] },
  },
  'caribbean-seagrass': {
    note: 'Wide seagrass beds on sandy banks, with patch reefs scattered across them',
    claim: 'place-florida-seagrass',
    sand: [232, 224, 200],
    rock: [[176, 166, 146]],
    coral: 0.35,
    forms: forms({ elkhorn: 0.2, massive: 0.4, fan: 0.4 }),
    palette: caribPalette,
    beds: { seagrass: 0.8, coral: 0.12 },
    grass: 'turtle',
    water: [64, 168, 170],
    clarity: 0.75,
    fish: { colour: [200, 200, 210], count: 14 },
  },
  'pink-sand': {
    note: "Bermuda's pink sand and clear blue water, over its reefs",
    claim: 'place-bermuda',
    sand: [240, 214, 206],
    rock: [[190, 170, 160]],
    coral: 0.55,
    forms: forms({ massive: 0.5, fan: 0.3, branching: 0.2 }),
    palette: caribPalette,
    beds: { coral: 0.3, seagrass: 0.15 },
    grass: 'turtle',
    water: [30, 140, 196],
    clarity: 1,
    fish: { colour: [120, 90, 200], count: 10 },
  },
  'rocky-algae': {
    note: 'Rocky shores, sandy beaches and tidal flats, with brown algae on the rock',
    claim: 'place-gulf-of-california',
    sand: [204, 190, 160],
    rock: [
      [120, 108, 96],
      [140, 126, 110],
    ],
    coral: 0.12,
    forms: forms({ massive: 0.6, soft: 0.4 }),
    palette: [
      [170, 130, 90],
      [190, 100, 120],
    ],
    beds: { rock: 0.6, kelp: 0.7 },
    grass: 'generic',
    water: [50, 130, 140],
    clarity: 0.6,
    fish: { colour: [200, 190, 120], count: 14 },
  },
  posidonia: {
    note: 'Neptune grass meadows, found only in the Mediterranean, in very clear, nutrient-poor water',
    claim: 'place-posidonia',
    sand: [220, 206, 178],
    rock: [[150, 140, 128]],
    coral: 0,
    forms: forms({ massive: 1 }),
    palette: [[180, 150, 110]],
    beds: { seagrass: 1, rock: 0.3 },
    grass: 'posidonia',
    water: [24, 110, 180],
    clarity: 1,
    fish: { colour: [180, 190, 200], count: 14 },
  },
  'shallow-gulf': {
    note: 'A very shallow sea, about 50 m deep on average, over sand',
    claim: 'place-persian-gulf',
    sand: [214, 198, 164],
    rock: [[170, 156, 132]],
    coral: 0.35,
    forms: forms({ massive: 0.5, branching: 0.3, table: 0.2 }),
    palette: indoPalette,
    beds: { sand: 0.5, coral: 0.15, rock: 0.15 },
    grass: 'generic',
    water: [70, 150, 150],
    clarity: 0.6,
    fish: { colour: [220, 200, 140], count: 12 },
  },
}

export const reefOf: Record<string, Reef> = {
  'red-sea': 'red-sea',
  'persian-gulf': 'shallow-gulf',
  'east-africa': 'indo-pacific',
  madagascar: 'indo-pacific',
  seychelles: 'granite',
  mauritius: 'indo-pacific',
  maldives: 'atoll',
  chagos: 'atoll',
  'sri-lanka': 'indo-pacific',
  andaman: 'indo-pacific',
  ningaloo: 'indo-pacific',
  'bali-komodo': 'coral-triangle',
  sulawesi: 'coral-triangle',
  ambon: 'coral-triangle',
  philippines: 'coral-triangle',
  'papua-new-guinea': 'coral-triangle',
  'solomon-islands': 'coral-triangle',
  okinawa: 'indo-pacific',
  taiwan: 'indo-pacific',
  palau: 'indo-pacific',
  guam: 'indo-pacific',
  'great-barrier-reef': 'indo-pacific',
  'new-caledonia': 'indo-pacific',
  vanuatu: 'indo-pacific',
  fiji: 'indo-pacific',
  'marshall-islands': 'atoll',
  'samoa-tonga': 'indo-pacific',
  'cook-islands': 'atoll',
  'french-polynesia': 'atoll',
  'hawaiian-islands': 'volcanic',
  'rapa-nui': 'volcanic',
  galapagos: 'volcanic',
  'gulf-of-california': 'rocky-algae',
  'florida-keys': 'caribbean-seagrass',
  'east-pacific-abyss': 'shallow-gulf',
  bahamas: 'caribbean-seagrass',
  bermuda: 'pink-sand',
  cuba: 'caribbean',
  'cayman-islands': 'caribbean',
  jamaica: 'caribbean',
  'puerto-rico': 'caribbean',
  'lesser-antilles': 'caribbean',
  'abc-islands': 'caribbean',
  'mesoamerican-reef': 'caribbean',
  'canary-islands': 'volcanic',
  'cape-verde': 'volcanic',
  mediterranean: 'posidonia',
}

/** Place-specific notes that sharpen a reef profile. */
const overrides: Record<string, Partial<Omit<PlaceLook, 'reef'>>> = {
  'east-pacific-abyss': {
    note: 'The abyss, about 2,500 to 3,600 m down: dark, soft muddy clay, and in places hard lava',
    claim: 'neopilina-range-depth',
    sand: [92, 84, 76],
    rock: [[40, 40, 44]],
    coral: 0,
    beds: {},
    water: [6, 20, 40],
    clarity: 0.3,
    fish: { colour: [0, 0, 0], count: 0 },
  },
  'hawaiian-islands': {
    note: 'Volcanic islands: black basalt reef, and schools of yellow tang, described from Hawaii',
    claim: 'place-hawaii',
    fish: { colour: [252, 214, 30], count: 18 },
  },
  'rapa-nui': {
    note: 'The summit of a volcanic ridge of seamounts: basalt boulders and sparse coral',
    claim: 'place-rapa-nui',
    coral: 0.25,
  },
  'canary-islands': {
    note: 'Volcanic islands of the eastern Atlantic: dark rock, little coral, brown algae',
    claim: 'place-canary',
    coral: 0.08,
    beds: { rock: 0.8, kelp: 0.4 },
    water: [30, 100, 160],
  },
  'cape-verde': {
    note: 'Ten volcanic islands of igneous rock: dark boulders and sand',
    claim: 'place-cape-verde',
    coral: 0.15,
  },
  galapagos: {
    note: 'Volcanic islands far out in the eastern Pacific: dark lava rock and sparse coral',
    claim: 'place-volcanic',
    coral: 0.12,
    beds: { rock: 0.8, kelp: 0.3 },
    water: [40, 120, 140],
    clarity: 0.7,
  },
  mauritius: {
    note: 'A lagoon ringed by one of the largest coral reefs, and white sand',
    claim: 'place-mauritius',
    sand: [242, 236, 220],
  },
  ningaloo: {
    note: "Australia's largest fringing reef, very close to the shore",
    claim: 'place-ningaloo',
  },
  okinawa: {
    note: 'Some of the most abundant coral reefs in the world surround these islands',
    claim: 'place-okinawa',
  },
  'florida-keys': {
    note: 'Seagrass covers the sand banks, with patch reefs scattered across them',
    claim: 'place-florida-seagrass',
  },
  bahamas: {
    note: 'Turtle grass meadows in shallow, sandy, calm water',
    claim: 'place-turtle-grass',
    sand: [246, 242, 228],
    water: [70, 196, 200],
    clarity: 1,
  },
}

/**
 * Water and sand matched to underwater photographs of each place (see
 * scripts/place-photos.py): the water is the colour that, darkened by depth as
 * the app does, looks like the photos' open water at about 8 m.
 */
type PhotoColours = Record<
  string,
  {
    water: number[]
    sand: number[]
    cast: number[]
    source: string
    photos: unknown[]
  }
>
export const matchedColours = photoColours as PhotoColours

export function placeLook(regionId: string): PlaceLook {
  const reef = reefOf[regionId] ?? 'indo-pacific'
  const matched = matchedColours[regionId]
  return {
    reef,
    ...profiles[reef],
    ...overrides[regionId],
    ...(matched
      ? {
          water: matched.water as Rgb,
          sand: matched.sand as Rgb,
          cast: matched.cast as [number, number, number],
        }
      : {}),
  }
}

export const reefLabels: Record<Reef, string> = {
  'coral-triangle': 'Coral Triangle reef',
  'indo-pacific': 'Indo-Pacific reef',
  'red-sea': 'Red Sea fringing reef',
  atoll: 'Atoll lagoon',
  granite: 'Granite reef',
  volcanic: 'Volcanic reef',
  caribbean: 'Caribbean reef',
  'caribbean-seagrass': 'Seagrass bank',
  'pink-sand': 'Pink-sand reef',
  'rocky-algae': 'Rocky reef',
  posidonia: 'Neptune grass meadow',
  'shallow-gulf': 'Shallow gulf',
}
