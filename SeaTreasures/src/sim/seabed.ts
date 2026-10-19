import type { PhaseId } from './life.ts'
import type { Rgb } from './patterns.ts'
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

/** A place's coast character: volcanic islands, seagrass meadows, or brown-algae forests. */
export type Coast = 'volcanic' | 'seagrass' | 'kelp' | 'reef'
export const coastOf: Record<string, Coast> = {
  'hawaiian-islands': 'volcanic',
  galapagos: 'kelp',
  'rapa-nui': 'volcanic',
  'canary-islands': 'kelp',
  'cape-verde': 'volcanic',
  'gulf-of-california': 'kelp',
  'persian-gulf': 'kelp',
  mediterranean: 'seagrass',
  'florida-keys': 'seagrass',
  bahamas: 'seagrass',
}
export const coastLabels: Record<Coast, string> = {
  volcanic: 'volcanic rock',
  seagrass: 'seagrass',
  kelp: 'kelp and brown algae',
  reef: 'coral reef',
}
const coastBeds: Record<Coast, Partial<Record<Bed, number>>> = {
  volcanic: { rock: 0.6 },
  seagrass: { seagrass: 0.6 },
  kelp: { kelp: 0.7, rock: 0.25 },
  reef: { coral: 0.3 },
}

export type Setting = {
  scene: Scene
  /** How much of each bed to draw, summing to 1. Empty in open water. */
  mix: Partial<Record<Bed, number>>
  /** The bed with the most weight. */
  main: Bed | null
  /** The sourced habitat text the bed was read from. */
  habitat: string
  coast: Coast
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

const groundFor = (main: Bed | null, coast: Coast, scene: Scene): Rgb => {
  if (scene === 'beach')
    return coast === 'volcanic' ? [92, 86, 82] : [228, 212, 172]
  switch (main) {
    case 'coral':
      return [226, 214, 188]
    case 'rubble':
      return [214, 202, 176]
    case 'seagrass':
      return [204, 194, 156]
    case 'kelp':
      return [150, 140, 116]
    case 'rock':
      return coast === 'volcanic' ? [96, 90, 86] : [150, 140, 126]
    case 'deep':
      return [96, 108, 118]
    default:
      return [222, 206, 170]
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
): Setting {
  const coast = coastOf[regionId] ?? 'reef'
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
    for (const [bed, weight] of Object.entries(coastBeds[coast]) as [
      Bed,
      number,
    ][])
      mix[bed] = (mix[bed] ?? 0) + weight * (deep ? 0.3 : 1)
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
    elsewhere,
    ground: groundFor(main, coast, scene),
    key: `${scene}|${coast}|${JSON.stringify(shares)}`,
  }
}

/** A short caption for the setting chip. */
export function settingLabel(setting: Setting) {
  if (setting.scene === 'open-water') return 'Open water'
  if (setting.scene === 'beach') return 'Beach'
  return setting.main ? bedLabels[setting.main] : 'Seabed'
}
