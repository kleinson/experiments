import raw from '../../data/species.json' with { type: 'json' }
import { getClaim } from '../evidence.ts'

export type Range = [number, number]

export type Duration = {
  text: string
  /** Days or years depending on the stage; null when it is not established. */
  range: Range | null
  unit: 'days' | 'years'
  claim: string | null
}

export type Origin = {
  id: string
  name: string
  habitat: string
  depthM: Range | null
  claim: string
}

export type DeathMark = 'drill' | 'chip' | 'none'

export type Species = {
  id: string
  commonName: string
  scientificName: string
  authority: string
  aphiaId: number
  taxonClaim: string
  group:
    | 'gastropod'
    | 'cephalopod'
    | 'bivalve'
    | 'chiton'
    | 'scaphopod'
    | 'monoplacophoran'
  /** Adult length used to draw the shell at true size, and its source. */
  lengthMm: {
    typical: Range | null
    max: number | null
    drawn: number
    claim: string
  }
  origins: Origin[]
  pattern: { description: string; claim: string }
  life: {
    egg: Duration
    larva: Duration
    maturity: Duration
    lifespan: Duration
  }
  deaths: { id: string; cause: string; mark: DeathMark; claim: string }[]
  remains: { id: string; text: string; claim: string }[]
  collecting: { id: string; text: string; claim: string }[]
  /** Whether hermit crabs can take over the empty shell (gastropods). */
  hermit: boolean
  /** Whether the empty shell floats and drifts (chambered nautilus). */
  drifts: boolean
  /** Why the drawn length was chosen. */
  drawnNote: string
}

export type SpeciesData = {
  species: Species[]
  shared: { remains: Species['remains']; collecting: Species['collecting'] }
}

function check(data: SpeciesData) {
  const ids = new Set<string>()
  for (const species of data.species) {
    if (ids.has(species.id)) throw new Error(`Duplicate species: ${species.id}`)
    ids.add(species.id)
    const claims = [
      species.taxonClaim,
      species.lengthMm.claim,
      species.pattern.claim,
      ...species.origins.map((origin) => origin.claim),
      ...Object.values(species.life).flatMap((stage) =>
        stage.claim ? [stage.claim] : [],
      ),
      ...species.deaths.map((death) => death.claim),
      ...species.remains.map((item) => item.claim),
      ...species.collecting.map((item) => item.claim),
    ]
    for (const claim of claims) getClaim(claim)
    if (!species.origins.length)
      throw new Error(`${species.id} needs an origin.`)
    if (!(species.lengthMm.drawn > 0))
      throw new Error(`${species.id} needs a drawn length.`)
    for (const stage of Object.values(species.life)) {
      if (
        stage.range &&
        (stage.range[0] > stage.range[1] || stage.range[0] < 0)
      )
        throw new Error(`${species.id} has an impossible duration.`)
      if (stage.range && !stage.claim)
        throw new Error(`${species.id} states a duration without a source.`)
    }
  }
  for (const item of [...data.shared.remains, ...data.shared.collecting])
    getClaim(item.claim)
  return data
}

export const speciesData = check(raw as SpeciesData)
export const allSpecies = speciesData.species

export function getSpecies(id: string): Species {
  const found = allSpecies.find((species) => species.id === id)
  if (!found) throw new Error(`Unknown species: ${id}`)
  return found
}
