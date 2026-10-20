import { bedLabels, beds, habitatAt, habitatBeds } from './seabed.ts'
import type { Bed } from './seabed.ts'
import { originsFor, shellsAt } from './ranges.ts'
import { getSpecies } from './species.ts'
import type { Species } from './species.ts'

/**
 * The habitats a shell lives in, read from its sourced habitat text at each
 * of its places. A bed counts only where the text names it and it makes up a
 * fair share of the mix: "deep reef slopes" is a deep slope, not a coral reef,
 * and text that names no habitat adds nothing.
 */
const bedCache = new Map<string, Set<Bed>>()
export function bedsOf(species: Pick<Species, 'id'>): Set<Bed> {
  let found = bedCache.get(species.id)
  if (found) return found
  found = new Set<Bed>()
  const full = getSpecies(species.id)
  for (const origin of full.origins) {
    if (!/\w/.test(habitatAt(full, origin.id))) continue
    const mix = habitatBeds(full, origin.id)
    const named = Object.keys(mix).length > 1 || mix.sand !== 1
    if (!named) continue
    const total = Object.values(mix).reduce((sum, value) => sum + value, 0)
    for (const bed of beds) if ((mix[bed] ?? 0) / total >= 0.2) found.add(bed)
  }
  bedCache.set(species.id, found)
  return found
}

export const livesIn = (species: Pick<Species, 'id'>, bed: Bed | null) =>
  bed === null || bedsOf(species).has(bed)

/** The shells recorded at a place that live in a habitat, best recorded first. */
export const shellsIn = (
  placeId: string,
  speciesIds: string[],
  bed: Bed | null,
) =>
  shellsAt(placeId, speciesIds).filter((item) =>
    livesIn({ id: item.speciesId }, bed),
  )

/** The place with the most records of any shell that lives in a habitat. */
export function bestPlaceFor(bed: Bed, speciesIds: string[]) {
  let best: { speciesId: string; placeId: string; n: number } | null = null
  for (const speciesId of speciesIds) {
    if (!livesIn({ id: speciesId }, bed)) continue
    for (const place of originsFor(speciesId))
      if (!place.outside && (!best || place.count.n > best.n))
        best = { speciesId, placeId: place.region.id, n: place.count.n }
  }
  return best
}

/** How many of the shells live in each habitat, anywhere. */
export const shellsPerBed = (speciesIds: string[]) =>
  Object.fromEntries(
    beds.map((bed) => [
      bed,
      speciesIds.filter((id) => livesIn({ id }, bed)).length,
    ]),
  ) as Record<Bed, number>

export const habitatName = (bed: Bed) => bedLabels[bed].toLowerCase()
