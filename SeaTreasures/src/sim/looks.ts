import type { PatternSpec, Rgb } from './patterns.ts'

/**
 * How each species is drawn: pattern recipe, interior and living-tissue
 * colours. Colours approximate the real shell for illustration; the written
 * descriptions in the species data are the sourced reference.
 */
export type Look = {
  pattern: PatternSpec
  inside: Rgb
  /** Nacre (mother-of-pearl) shimmer on the inside, as in the nautilus. */
  nacre?: boolean
  tissue: Rgb
  seed: number
  /** Pattern canvas size: along the growth record, then around the edge. */
  size?: [number, number]
}

export const looks: Record<string, Look> = {
  'tiger-cowrie': {
    pattern: {
      kind: 'spots',
      ground: [236, 228, 214],
      spot: [52, 36, 30],
      base: [244, 240, 232],
      count: 260,
    },
    inside: [214, 200, 230],
    tissue: [120, 92, 76],
    seed: 4173,
  },
  'money-cowrie': {
    pattern: {
      kind: 'plain',
      ground: [236, 206, 120],
      margin: [244, 236, 214],
      ring: [214, 150, 70],
    },
    inside: [242, 236, 222],
    tissue: [96, 84, 70],
    seed: 92,
  },
  'textile-cone': {
    pattern: {
      kind: 'tents',
      ground: [168, 104, 44],
      line: [62, 36, 20],
      light: [246, 240, 228],
      rate: 0.09,
    },
    inside: [232, 216, 236],
    tissue: [110, 98, 84],
    seed: 707,
    size: [520, 700],
  },
  'queen-conch': {
    pattern: {
      kind: 'blotches',
      ground: [232, 212, 182],
      blotch: [170, 120, 80],
    },
    inside: [238, 150, 140],
    tissue: [128, 108, 90],
    seed: 1985,
  },
  'chambered-nautilus': {
    pattern: {
      kind: 'flames',
      ground: [244, 238, 228],
      flame: [168, 82, 46],
      fadeFrom: 0.55,
    },
    inside: [226, 230, 236],
    nacre: true,
    tissue: [196, 150, 120],
    seed: 2016,
  },
  // The other classes are painted per vertex in classes.ts; these colours give the menu swatch.
  'giant-clam': {
    pattern: { kind: 'plain', ground: [226, 222, 210], margin: [118, 112, 58] },
    inside: [246, 244, 238],
    tissue: [118, 112, 58],
    seed: 11,
  },
  'fuzzy-chiton': {
    pattern: { kind: 'plain', ground: [150, 136, 110], margin: [96, 90, 80] },
    inside: [220, 214, 200],
    tissue: [150, 136, 110],
    seed: 12,
  },
  'tusk-shell': {
    pattern: { kind: 'plain', ground: [240, 236, 226], margin: [150, 96, 52] },
    inside: [244, 240, 232],
    tissue: [226, 196, 170],
    seed: 13,
  },
  monoplacophoran: {
    pattern: { kind: 'plain', ground: [160, 130, 96], margin: [56, 40, 30] },
    inside: [236, 232, 220],
    tissue: [226, 206, 180],
    seed: 14,
  },
}
