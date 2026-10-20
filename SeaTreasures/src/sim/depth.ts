import type { Species } from './species.ts'

/**
 * How deep each animal lives, from its sources. Where a source gives no
 * number, the simulator draws it in shallow water and says the depth is not
 * established in metres.
 */
export type Depth = {
  /** Recorded range in metres, or null when only described in words. */
  range: [number, number] | null
  /** Depth the scene opens at, metres. */
  drawn: number
  /** What the reader can scroll through, metres. */
  reach: [number, number]
  /** Short words for the depth when there is no range. */
  words: string
  claim: string
}

const SHALLOW_NAUTILUS = new Set(['vanuatu', 'new-caledonia'])

export function depthFor(species: Species, regionId: string): Depth {
  switch (species.id) {
    case 'tiger-cowrie':
      return {
        range: [10, 40],
        drawn: 18,
        reach: [10, 40],
        words: 'often with live coral',
        claim: 'depth-tiger-cowrie',
      }
    case 'money-cowrie':
      return {
        range: null,
        drawn: 1.5,
        reach: [0.5, 5],
        words: 'Intertidal rocks and shallow tide pools',
        claim: 'depth-money-cowrie',
      }
    case 'textile-cone':
      return {
        range: null,
        drawn: 4,
        reach: [1, 15],
        words: 'Shallow: rocky shores, rock pools, reef sand',
        claim: 'depth-textile-cone',
      }
    case 'queen-conch': {
      const origin =
        species.origins.find((item) => item.id === regionId) ??
        species.origins[0]!
      const range = origin.depthM ?? [0, 30]
      return {
        range: [range[0], range[1]],
        drawn: 8,
        reach: [Math.max(1, range[0]), range[1]],
        words: `Most common shallower than ${range[1]} m`,
        claim: 'queen-conch-range-habitat',
      }
    }
    case 'chambered-nautilus': {
      const shallow = SHALLOW_NAUTILUS.has(regionId)
      return {
        range: shallow ? [5, 800] : [100, 800],
        drawn: shallow ? 40 : 250,
        reach: shallow ? [5, 500] : [100, 600],
        words: shallow
          ? 'Here as shallow as 5 m; elsewhere several hundred metres'
          : 'Usually several hundred metres down',
        claim: 'depth-nautilus',
      }
    }
    default:
      return {
        range: null,
        drawn: 10,
        reach: [1, 30],
        words: 'Depth not established',
        claim: 'seabed-setting-illustrative',
      }
  }
}

/** How much daylight reaches a depth, 0–1, for water of a given clarity (0–1). */
export function daylightAt(depthM: number, clarity: number) {
  // A gentle falloff so 10–20 m still reads as bright reef, and 200 m as near dark.
  const length = 35 + 45 * clarity
  return Math.exp(-depthM / length)
}

export const formatDepth = (metres: number) =>
  metres < 10 ? `${Math.round(metres * 10) / 10} m` : `${Math.round(metres)} m`
