import type { AnatomyPart } from './animal.ts'

/** What each lit part is, in words drawn from a claim in the source manifest. */
export const partNotes: Record<
  AnatomyPart,
  { label: string; note: string; claim: string }
> = {
  shell: {
    label: 'Shell',
    note: 'The last whorl grows over and hides the earlier, juvenile whorls inside the smooth adult shell.',
    claim: 'cowrie-inner-whorls',
  },
  mantle: {
    label: 'Mantle lobes',
    note: 'Two lobes spread over the shell and lay down the glossy outer coat. Here they are tinted as tissue.',
    claim: 'cowrie-mantle-gloss-layer',
  },
  foot: {
    label: 'Foot',
    note: 'A broad, muscular foot for crawling, part of the head-foot shared with other snails of its kind.',
    claim: 'cowrie-animal-anatomy',
  },
  visceral: {
    label: 'Visceral mass',
    note: 'The soft body inside the whorls, holding the gut, digestive gland, gonad, heart and kidney.',
    claim: 'gastropod-internal-anatomy',
  },
  head: {
    label: 'Head, tentacles and eyes',
    note: 'A pair of cephalic tentacles, with eyes on the head.',
    claim: 'cowrie-animal-anatomy',
  },
  siphon: {
    label: 'Siphon',
    note: 'An anterior siphon, lying in the channel at the front of the narrow aperture.',
    claim: 'cowrie-animal-anatomy',
  },
  gill: {
    label: 'Gill (ctenidium)',
    note: 'The gill sits in the mantle cavity, a comb of thin plates.',
    claim: 'gastropod-internal-anatomy',
  },
  osphradium: {
    label: 'Osphradium',
    note: 'A chemical-sensing organ beside the gill in the mantle cavity.',
    claim: 'gastropod-internal-anatomy',
  },
  heart: {
    label: 'Heart',
    note: 'Part of the visceral mass inside the shell.',
    claim: 'gastropod-internal-anatomy',
  },
  kidney: {
    label: 'Kidney',
    note: 'Part of the visceral mass, next to the heart.',
    claim: 'gastropod-internal-anatomy',
  },
  stomach: {
    label: 'Stomach',
    note: 'Part of the digestive tract inside the visceral mass.',
    claim: 'gastropod-internal-anatomy',
  },
  digestive: {
    label: 'Digestive gland',
    note: 'A large organ of the visceral mass, filling the inner whorls.',
    claim: 'gastropod-internal-anatomy',
  },
  gonad: {
    label: 'Gonad',
    note: 'The reproductive organ, carried in the visceral mass.',
    claim: 'gastropod-internal-anatomy',
  },
  gut: {
    label: 'Gut',
    note: 'The digestive tract, running from the mouth back through the body.',
    claim: 'gastropod-internal-anatomy',
  },
  radula: {
    label: 'Radula',
    note: 'A taenioglossate radula: a ribbon of small rasping teeth. Adults have no operculum.',
    claim: 'gastropod-internal-anatomy',
  },
}

/** The order an idle tour visits parts: outside first, then inside. */
export const tourOrder: AnatomyPart[] = [
  'mantle',
  'foot',
  'head',
  'siphon',
  'shell',
  'gill',
  'osphradium',
  'heart',
  'kidney',
  'digestive',
  'stomach',
  'gonad',
  'gut',
  'radula',
]

export const insideParts = new Set<AnatomyPart>([
  'gill',
  'osphradium',
  'heart',
  'kidney',
  'stomach',
  'digestive',
  'gonad',
  'gut',
  'radula',
  'visceral',
])
