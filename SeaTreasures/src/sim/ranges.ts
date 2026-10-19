import raw from '../../data/ranges.json' with { type: 'json' }
import { getClaim } from '../evidence.ts'

export type Ocean = keyof typeof raw.oceans
export type Region = {
  id: string
  name: string
  ocean: Ocean
  bbox: [number, number, number, number]
  /** Map position, in the map's own pixels. */
  at: [number, number]
  box: [number, number, number, number]
}
export type Count = { n: number; observed: number; specimens: number }
export type Level = 'none' | 'isolated' | 'recorded' | 'often'

type Records = {
  taxonKey: number
  total: Count
  regions: Record<string, Count>
  native: { oceans: Ocean[]; claim: string } | null
}

export const ranges = {
  accessedAt: raw.accessedAt,
  oceans: raw.oceans as Record<Ocean, string>,
  map: raw.map as unknown as {
    width: number
    viewBox: [number, number, number, number]
    land: string
  },
  regions: raw.regions as unknown as Region[],
  records: raw.records as unknown as Record<string, Records>,
}

/** Fewer records than this are shown as isolated: possibly errors, imports or shells moved by people. */
export const ISOLATED_BELOW = 5
/** At least this many records counts as often recorded. */
export const OFTEN_FROM = 50

for (const [speciesId, entry] of Object.entries(ranges.records)) {
  getClaim(`${speciesId}-gbif-records`)
  if (entry.native) getClaim(entry.native.claim)
  for (const regionId of Object.keys(entry.regions))
    if (!ranges.regions.some((region) => region.id === regionId))
      throw new Error(`Unknown region ${regionId} in the ${speciesId} records.`)
}

export const levelOf = (n: number): Level =>
  n === 0
    ? 'none'
    : n < ISOLATED_BELOW
      ? 'isolated'
      : n < OFTEN_FROM
        ? 'recorded'
        : 'often'

export function regionFor(id: string) {
  return ranges.regions.find((region) => region.id === id) ?? null
}

/** Every region for a species, with its records and whether it lies outside the documented range. */
export function placesFor(speciesId: string) {
  const entry = ranges.records[speciesId]
  return ranges.regions.map((region) => {
    const count = entry?.regions[region.id] ?? {
      n: 0,
      observed: 0,
      specimens: 0,
    }
    const outside = Boolean(
      entry?.native &&
      count.n > 0 &&
      !entry.native.oceans.includes(region.ocean),
    )
    return { region, count, level: levelOf(count.n), outside }
  })
}

/** Regions a reader can pick as the shell's origin: recorded there, most records first. */
export function originsFor(speciesId: string) {
  return placesFor(speciesId)
    .filter((place) => place.count.n > 0)
    .sort(
      (a, b) => Number(a.outside) - Number(b.outside) || b.count.n - a.count.n,
    )
}

export const totalFor = (speciesId: string) =>
  ranges.records[speciesId]?.total ?? null
