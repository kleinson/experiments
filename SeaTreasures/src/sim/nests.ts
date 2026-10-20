import type { Fact } from './crawl.ts'

/**
 * Where each species lays its eggs, from its sources. This decides the setting
 * of the egg stage and how the eggs are drawn:
 * - `brood`: a cowrie's layered capsule mass glued to rubble in a crevice, the
 *   mother sitting over it.
 * - `under-rock`: cone snail capsules stuck to the underside of a rock.
 * - `crevice`: single large eggs tucked between rocks (nautilus, in aquariums).
 * - `sand`: a sand-coated egg strand folded on clean sand (queen conch).
 * - `water`: eggs spawned into the sea, drifting (giant clam, chiton, tusk shell).
 * - `unknown`: no source says; the eggs are shown loose on the seabed.
 */
export type NestKind =
  'brood' | 'under-rock' | 'crevice' | 'sand' | 'water' | 'unknown'

export type Nest = { kind: NestKind; fact: Fact | null }

const NESTS: Record<string, Nest> = {
  'tiger-cowrie': {
    kind: 'brood',
    fact: {
      text: 'Laid in a crevice among coral rubble: the capsules are glued in layers to a hard surface, and the mother sits over them, covering them with her foot until they hatch.',
      claim: 'tiger-cowrie-egg-site',
    },
  },
  'money-cowrie': {
    kind: 'brood',
    fact: {
      text: 'Like most cowries, the female glues her egg capsules to a hard surface and covers them with her foot until the larvae hatch.',
      claim: 'cowrie-egg-brooding',
    },
  },
  'textile-cone': {
    kind: 'under-rock',
    fact: {
      text: 'Cone snails glue each capsule by its base to a hard surface, usually the underside of a rock or dead coral, in clusters of up to several dozen.',
      claim: 'conus-egg-site',
    },
  },
  'queen-conch': {
    kind: 'sand',
    fact: {
      text: 'Laid on clean coral sand: one long egg strand folded into a compact clump, coated in sand grains that hide it.',
      claim: 'queen-conch-egg-site',
    },
  },
  'chambered-nautilus': {
    kind: 'crevice',
    fact: {
      text: 'Never seen in the wild. In aquariums the female lays her eggs one at a time in crevices or between corals.',
      claim: 'nautilus-egg-site',
    },
  },
  'giant-clam': {
    kind: 'water',
    fact: {
      text: 'There is no nest: the clam releases its eggs into the water, where they are fertilised and drift.',
      claim: 'giant-clam-spawning',
    },
  },
  'fuzzy-chiton': {
    kind: 'water',
    fact: {
      text: 'There is no nest: females release their eggs into the water, where they are fertilised and drift.',
      claim: 'fuzzy-chiton-reproduction',
    },
  },
  'tusk-shell': {
    kind: 'water',
    fact: {
      text: 'There is no nest: eggs and sperm are released into the water.',
      claim: 'tusk-shell-larva',
    },
  },
}

export const nestFor = (speciesId: string): Nest =>
  NESTS[speciesId] ?? { kind: 'unknown', fact: null }

/** True when the eggs are laid on or under rock rather than on sand or in the water. */
export const onRock = (kind: NestKind) =>
  kind === 'brood' || kind === 'under-rock' || kind === 'crevice'
