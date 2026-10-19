/** One labelled part: a short explanation and the claim it rests on. */
export type Term = { text: string; claim: string }

/**
 * What each label in the figure means. Every line is drawn from the claim it
 * cites; parts are named, not described beyond what the sources say.
 */
export const glossary: Record<string, Term> = {
  Apex: {
    text: 'The tip of the spire: the larval shell the animal started life in.',
    claim: 'term-gastropod-shell-parts',
  },
  Aperture: {
    text: 'The opening. New shell is added only at its growing edge.',
    claim: 'shell-mantle-secretes',
  },
  'Body whorl': {
    text: 'The last and largest turn of the coil, ending at the opening.',
    claim: 'term-gastropod-shell-parts',
  },
  Columella: {
    text: 'The central pillar the coil turns around.',
    claim: 'term-gastropod-shell-parts',
  },
  'Thick lip': {
    text: 'Once mature, the conch stops growing longer; the lip only thickens.',
    claim: 'queen-conch-maturity',
  },
  'Toothed aperture': {
    text: 'A narrow, tooth-lined opening on the underside that forms at maturity.',
    claim: 'aperture-teeth-at-maturity',
  },
  Dorsum: {
    text: 'The domed back. The mantle spreads over it and keeps it glossy.',
    claim: 'mantle-coating-and-polish',
  },
  'Young spire': {
    text: 'A juvenile cowrie still shows its coil; the last whorl later grows over it.',
    claim: 'cowrie-inner-whorls',
  },
  Mantle: {
    text: 'Soft lobes that secrete the shell and can cover it while active.',
    claim: 'mantle-coating-and-polish',
  },
  'Visceral mass': {
    text: 'Organs coiled inside the whorls: gonad, digestive gland, heart, kidney.',
    claim: 'gastropod-internal-anatomy',
  },
  Foot: {
    text: 'A single muscular foot the animal crawls on.',
    claim: 'mollusca-body-plan',
  },
  Tentacle: {
    text: 'A pair of tentacles on the head, with an eye near each.',
    claim: 'cowrie-animal-anatomy',
  },
  'Eye stalk': {
    text: 'Long eye stalks that move independently.',
    claim: 'queen-conch-appearance',
  },
  Proboscis: {
    text: 'A tube-like mouth it reaches out to feed.',
    claim: 'queen-conch-appearance',
  },
  Operculum: {
    text: 'A brown, rough plate it can seal the opening with.',
    claim: 'queen-conch-appearance',
  },
  Siphon: {
    text: 'A tube that draws water in from the front of the opening.',
    claim: 'cowrie-animal-anatomy',
  },
  'Banded siphon': {
    text: 'The textile cone’s siphon is banded black and red.',
    claim: 'textile-cone-size-pattern',
  },
  Septum: {
    text: 'A thin wall closing off an old chamber, built as the animal moves forward.',
    claim: 'term-nautilus-chambers',
  },
  Siphuncle: {
    text: 'A tube through every chamber, used to adjust buoyancy.',
    claim: 'nautilus-buoyancy',
  },
  'Living chamber': {
    text: 'The newest, largest chamber, where the animal lives.',
    claim: 'nautilus-buoyancy',
  },
  Hood: {
    text: 'A leathery hood, formed from two folded tentacles, that closes the opening.',
    claim: 'term-nautilus-chambers',
  },
  Tentacles: {
    text: 'More than 90 tentacles, without suckers.',
    claim: 'nautilus-appearance',
  },
  Funnel: {
    text: 'Pushes water out to swim backwards by jet propulsion.',
    claim: 'term-nautilus-chambers',
  },
  'Egg capsule': {
    text: 'Nearly all molluscs lay eggs; these hatch as larvae or small adults.',
    claim: 'mollusca-larvae',
  },
  Velum: {
    text: 'Ciliated lobes the larva swims and feeds with, lost when it settles.',
    claim: 'term-veliger-velum',
  },
  'Larval shell': {
    text: 'The first shell. It stays on as the apex of the adult.',
    claim: 'term-gastropod-shell-parts',
  },
  'Hermit crab': {
    text: 'Empty shells are commonly reused by hermit crabs as portable homes.',
    claim: 'hermit-crab-shell-reuse',
  },
  'Drill hole': {
    text: 'Moon snails, murex snails and octopuses can leave holes like this.',
    claim: 'predator-drill-holes',
  },
  'Broken lip': {
    text: 'Crabs and other predators can break the shell’s edge.',
    claim: 'predator-drill-holes',
  },
}
