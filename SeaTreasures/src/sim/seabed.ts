import type { PhaseId } from './life.ts'
import type { Rgb } from './patterns.ts'
import { depthFor } from './depth.ts'
import type { Depth } from './depth.ts'
import { placeLook } from './places.ts'
import type { PlaceLook } from './places.ts'
import type { Species } from './species.ts'

/**
 * The seabed drawn around the specimen. It is an illustrative setting: the
 * main bed comes from the species' sourced habitat, and the chosen place adds
 * a touch of its coast's well-known character. It is not a survey of where
 * the species lives at that place (see claim `seabed-setting-illustrative`).
 */
export const beds = [
  'coral',
  'rubble',
  'sand',
  'seagrass',
  'kelp',
  'rock',
  'deep',
] as const
export type Bed = (typeof beds)[number]
export type Scene = 'seabed' | 'beach' | 'open-water'

export const bedLabels: Record<Bed, string> = {
  coral: 'Coral reef',
  rubble: 'Coral rubble',
  sand: 'Sand flat',
  seagrass: 'Seagrass meadow',
  kelp: 'Kelp & brown algae',
  rock: 'Rocky reef',
  deep: 'Deep reef slope',
}

/** Habitat words in the sourced descriptions, and the bed each one suggests. */
const habitatWords: [RegExp, Bed, number][] = [
  [/deep/i, 'deep', 1.4],
  [/dead coral|rubble/i, 'rubble', 0.8],
  [
    /coral reef|reef flat|reef water|reef rock|reef slope|reef and/i,
    'coral',
    1,
  ],
  [/sand/i, 'sand', 0.8],
  [/seagrass/i, 'seagrass', 1],
  [/rock|tide pool|intertidal/i, 'rock', 1],
]

/** A place's coast character, read from its place profile (places.ts). */
export type Coast = 'volcanic' | 'seagrass' | 'kelp' | 'reef'
export const coastLabels: Record<Coast, string> = {
  volcanic: 'volcanic rock',
  seagrass: 'seagrass',
  kelp: 'kelp and brown algae',
  reef: 'coral reef',
}
const coastFor = (place: PlaceLook): Coast =>
  place.reef === 'volcanic'
    ? 'volcanic'
    : (place.beds.kelp ?? 0) >= 0.5
      ? 'kelp'
      : (place.beds.seagrass ?? 0) >= 0.5
        ? 'seagrass'
        : 'reef'

export type Setting = {
  scene: Scene
  /** How much of each bed to draw, summing to 1. Empty in open water. */
  mix: Partial<Record<Bed, number>>
  /** The bed with the most weight. */
  main: Bed | null
  /** The sourced habitat text the bed was read from. */
  habitat: string
  coast: Coast
  /** What this place looks like: reef, sand, rock, plants, water and fish. */
  place: PlaceLook
  /** How deep the animal lives here (sourced), and the depth drawn now, metres. */
  depth: Depth
  depthM: number
  /** True when the reader picked a bed this species' habitat does not mention. */
  elsewhere: boolean
  /** Ground colour, sRGB 0–255. */
  ground: Rgb
  /** A stable key: rebuild the scenery only when this changes. */
  key: string
}

const normalise = (mix: Partial<Record<Bed, number>>) => {
  const total = Object.values(mix).reduce((sum, value) => sum + value, 0)
  const out: Partial<Record<Bed, number>> = {}
  for (const bed of beds)
    if (mix[bed]) out[bed] = Math.round((mix[bed]! / total) * 1000) / 1000
  return out
}

const mainOf = (mix: Partial<Record<Bed, number>>) =>
  beds.reduce<Bed | null>(
    (best, bed) =>
      (mix[bed] ?? 0) > (best ? (mix[best] ?? 0) : 0) ? bed : best,
    null,
  )

/** The habitat text for a place: its own if sourced, otherwise the species' first. */
export function habitatAt(species: Species, regionId: string) {
  return (
    species.origins.find((origin) => origin.id === regionId) ??
    species.origins[0]!
  ).habitat
}

/** Beds suggested by the habitat alone. */
export function habitatBeds(species: Species, regionId: string) {
  const text = habitatAt(species, regionId)
  const mix: Partial<Record<Bed, number>> = {}
  for (const [pattern, bed, weight] of habitatWords)
    if (pattern.test(text)) mix[bed] = (mix[bed] ?? 0) + weight
  // A deep reef slope is mostly slope: coral there is sparse.
  if (mix.deep && mix.coral) mix.coral *= 0.3
  if (!Object.keys(mix).length) mix.sand = 1
  return mix
}

const blend = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
]
/** The ground takes the place's own sand, greyed by rock or a deep slope's silt. */
const groundFor = (main: Bed | null, place: PlaceLook, scene: Scene): Rgb => {
  if (scene === 'beach') return place.sand
  switch (main) {
    case 'rock':
      return blend(place.sand, place.rock[0]!, 0.35)
    case 'kelp':
      return blend(place.sand, [120, 110, 90], 0.3)
    case 'seagrass':
      return blend(place.sand, [170, 160, 120], 0.2)
    case 'deep':
      return blend(place.sand, [96, 108, 118], 0.6)
    default:
      return place.sand
  }
}

/**
 * The setting for a species, at a place, in one part of its life. `override`
 * is a bed the reader picked; `null` follows the habitat.
 */
export function seabedFor(
  species: Species,
  regionId: string,
  phase: PhaseId,
  override: Bed | null = null,
  depthM: number | null = null,
): Setting {
  const place = placeLook(regionId)
  const coast = coastFor(place)
  const depth = depthFor(species, regionId)
  const habitat = habitatAt(species, regionId)
  const scene: Scene =
    phase === 'beach' || phase === 'found'
      ? 'beach'
      : phase === 'larva' && species.group !== 'cephalopod'
        ? 'open-water'
        : 'seabed'
  const own = habitatBeds(species, regionId)
  let mix: Partial<Record<Bed, number>>
  if (scene === 'open-water') mix = {}
  else if (override) mix = { [override]: 1 }
  else {
    mix = { ...own }
    const deep = (own.deep ?? 0) > 0
    for (const [bed, weight] of Object.entries(place.beds) as [Bed, number][])
      mix[bed] = (mix[bed] ?? 0) + weight * (deep ? 0.3 : 1)
    // Reef-building corals and seagrass need sunlight (water-light-depth): none in deep water.
    const metres = depthM ?? depth.drawn
    if (metres > 60) {
      delete mix.coral
      delete mix.seagrass
      delete mix.kelp
      mix.deep = Math.max(mix.deep ?? 0, 1)
    }
  }
  if (scene === 'beach') {
    // Washed ashore: what lies on the sand echoes the bed offshore.
    mix = { sand: 1, ...(mix.coral || mix.rubble ? { rubble: 0.4 } : {}) }
    if (mix.rubble === undefined && (own.seagrass || override === 'seagrass'))
      mix.seagrass = 0.2
    if (coast === 'volcanic') mix.rock = 0.4
    if (coast === 'kelp' || override === 'kelp') mix.kelp = 0.25
  }
  const shares = Object.keys(mix).length ? normalise(mix) : {}
  const main = mainOf(shares)
  const ownTotal = Object.values(own).reduce((sum, value) => sum + value, 0)
  const elsewhere = override !== null && (own[override] ?? 0) / ownTotal < 0.15
  return {
    scene,
    mix: shares,
    main,
    habitat,
    coast,
    place,
    depth,
    depthM:
      scene === 'beach'
        ? 0
        : Math.min(
            depth.reach[1],
            Math.max(depth.reach[0], depthM ?? depth.drawn),
          ),
    elsewhere,
    ground: groundFor(main, place, scene),
    key: `${scene}|${regionId}|${JSON.stringify(shares)}`,
  }
}

/** A short caption for the setting chip. */
export function settingLabel(setting: Setting) {
  if (setting.scene === 'open-water') return 'Open water'
  if (setting.scene === 'beach') return 'Beach'
  return setting.main ? bedLabels[setting.main] : 'Seabed'
}
