/**
 * One labelled part: what it is, what the animal uses it for, and the claim
 * that use rests on. `what` is a short name-level description; `use` is the
 * real information, and every sentence of it comes from the cited claim.
 */
export type Term = { what: string; use: string; claim: string }

/**
 * What each label in the figure means. Some parts work differently in
 * different animals, so a species can have its own entry (see `termFor`).
 */
export const glossary: Record<string, Term> = {
  Apex: {
    what: 'The tip of the spire.',
    use: 'This is the larval shell the animal built as an embryo or larva, the protoconch. Every later whorl grew on from it; in some snails it dissolves once the juvenile shell starts forming.',
    claim: 'part-protoconch',
  },
  Aperture: {
    what: 'The main opening of the shell.',
    use: 'It is where the shell grows: the mantle’s edge lays thin new layers on its rim, so the opening is always the newest part of the shell.',
    claim: 'part-aperture',
  },
  'Body whorl': {
    what: 'The last and largest turn of the coil.',
    use: 'It ends at the opening. The whorls grow steadily larger from the larval shell at the apex, so each earlier whorl is the shell at a younger, smaller size.',
    claim: 'term-gastropod-shell-parts',
  },
  Columella: {
    what: 'The central pillar the coil turns around.',
    use: 'The columellar muscle is anchored along it. Contracting that muscle pulls the foot and head into the shell, away from predators and drying out, and draws the operculum shut.',
    claim: 'part-columella',
  },
  'Thick lip': {
    what: 'The flared outer lip of the opening.',
    use: 'Juveniles have none: the lip flares once the conch reaches breeding age, and keeps thickening, so the thicker the lip, the older the animal.',
    claim: 'part-conch-lip',
  },
  'Toothed aperture': {
    what: 'A narrow, tooth-lined opening underneath.',
    use: 'It forms only at maturity, when the outer lip thickens and curls inward; after that the cowrie stops getting longer. Juveniles have a wide, thin-lipped opening.',
    claim: 'cowrie-juvenile-bulla-to-adult',
  },
  Dorsum: {
    what: 'The domed back of the shell.',
    use: 'While the animal is active its mantle spreads up and over it and keeps the surface smooth; that is why living cowries are so glossy.',
    claim: 'mantle-coating-and-polish',
  },
  'Young spire': {
    what: 'The coil of a juvenile cowrie.',
    use: 'Young cowries still show an ordinary snail spiral. As they mature the last whorl grows over and hides all the earlier ones.',
    claim: 'cowrie-inner-whorls',
  },
  Mantle: {
    what: 'The soft body wall over the organs.',
    use: 'Its skin secretes calcium carbonate and protein to build the shell. In cowries it also spreads out over the outside of the shell, partly or fully covering it.',
    claim: 'part-mantle',
  },
  'Visceral mass': {
    what: 'The organs coiled up inside the whorls.',
    use: 'Gonad, digestive gland, heart, kidney and part of the gut sit coiled inside the whorls; the gill lies in the mantle cavity.',
    claim: 'gastropod-internal-anatomy',
  },
  Foot: {
    what: 'The single muscular foot under the body.',
    use: 'Most molluscs move on a single muscular foot. The name gastropod means “stomach-foot”, because the foot lies beneath the guts.',
    claim: 'part-gastropod-head-foot',
  },
  Tentacle: {
    what: 'A sensory tentacle on the head.',
    use: 'Snails carry two or four sensory tentacles with eyes; many smell their surroundings through receptors in the tentacle skin.',
    claim: 'part-gastropod-head-foot',
  },
  'Eye stalk': {
    what: 'One of two long eye stalks.',
    use: 'Each carries a well-developed eye, held up clear of the heavy shell; extra sensory tentacles sit beside them.',
    claim: 'part-conch-body',
  },
  Proboscis: {
    what: 'The long, tube-like snout.',
    use: 'With it the conch browses algae and plant material in seagrass beds, and scavenges decaying plant matter.',
    claim: 'part-conch-body',
  },
  Operculum: {
    what: 'A hard plate on the foot.',
    use: 'It works as a trapdoor: when the animal withdraws, it closes the opening, mainly to stop it drying out and, where it seals tightly, against predators.',
    claim: 'part-operculum',
  },
  Siphon: {
    what: 'A soft tube at the front of the opening.',
    use: 'It draws water into the mantle cavity and over the gill for breathing, and its chemoreceptors “smell” or “taste” the water to find food.',
    claim: 'part-siphon',
  },
  'Banded siphon': {
    what: 'The black-and-red banded siphon.',
    use: 'It draws water into the mantle cavity and over the gill for breathing, and its chemoreceptors taste the water to hunt for food.',
    claim: 'part-siphon',
  },
  Septum: {
    what: 'A thin wall across the coil.',
    use: 'As the nautilus grows it moves forward into a new living chamber and builds a septum behind it, sealing off the old one. A tube, the siphuncle, pierces each wall.',
    claim: 'term-nautilus-chambers',
  },
  Siphuncle: {
    what: 'A strand of tissue through every chamber.',
    use: 'It empties water from new chambers: the blood inside is made saltier, water leaves by osmosis and gases diffuse in. It works passively, not by pumping.',
    claim: 'part-siphuncle',
  },
  'Living chamber': {
    what: 'The newest, largest chamber.',
    use: 'The whole animal lives here. It uses the older chambers behind it, and the tube running through them, to control its buoyancy.',
    claim: 'nautilus-buoyancy',
  },
  Hood: {
    what: 'A leathery lid over the opening.',
    use: 'It is made of two folded tentacles. When the nautilus withdraws completely into its shell, the hood closes the opening behind it.',
    claim: 'term-nautilus-chambers',
  },
  Tentacles: {
    what: '50 to over 90 slender tentacles.',
    use: 'Those beside the eyes are for sensing; the rest ring the mouth. They have no suckers, yet grip with an adhesive from ridges on their surface and let go by contracting.',
    claim: 'part-nautilus-tentacles',
  },
  Funnel: {
    what: 'The muscular funnel, or hyponome.',
    use: 'The nautilus swims by jet propulsion, pushing water in and out of its living chamber through the funnel, and proves efficient at it compared with squid and jellyfish.',
    claim: 'part-nautilus-funnel',
  },
  'Egg capsule': {
    what: 'A protective case around the eggs.',
    use: 'Nearly all molluscs lay eggs. Depending on the group they hatch as swimming larvae or as miniature adults.',
    claim: 'mollusca-larvae',
  },
  Velum: {
    what: 'The larva’s ciliated lobes.',
    use: 'The beating cilia let the veliger swim and gather food particles; both velum and foot can be pulled into the shell for safety. It is lost when the larva settles.',
    claim: 'term-veliger-velum',
  },
  'Larval shell': {
    what: 'The first, larval shell.',
    use: 'Built by the embryo or larva, it is where the adult shell grows on from, so it stays as the tip of the spire; in some snails it later dissolves.',
    claim: 'part-protoconch',
  },
  'Hermit crab': {
    what: 'A crab living in the empty shell.',
    use: 'Its abdomen is soft and not hardened by calcium, so it must borrow a shell made by another animal; almost 800 species carry snail shells around.',
    claim: 'part-hermit-crab',
  },
  'Drill hole': {
    what: 'A neat round hole in the shell.',
    use: 'Moon snails plough through sand hunting shellfish and drill countersunk holes like this to reach the animal inside.',
    claim: 'part-naticid-drilling',
  },
  'Broken lip': {
    what: 'Chips in the shell’s edge.',
    use: 'Crabs, octopuses, birds and predatory snails can all leave damage and holes in mollusc shells.',
    claim: 'predator-drill-holes',
  },
}

/** Where a species uses a part its own way, its sourced entry replaces the general one. */
const bySpecies: Record<string, Record<string, Term>> = {
  'queen-conch': {
    Foot: {
      what: 'A large, powerful foot.',
      use: 'The conch leaps rather than crawls: it digs its operculum into the sand, extends the foot and throws the shell forward. Only the front third touches the ground, which may stop predators following its scent trail.',
      claim: 'part-conch-leap',
    },
    Operculum: {
      what: 'A brown, sickle-shaped operculum.',
      use: 'Besides closing the opening when the conch withdraws, its point is dug into the sand like an anchor to vault the shell forward.',
      claim: 'part-conch-leap',
    },
    'Body whorl': {
      what: 'The last and largest turn of the coil.',
      use: 'The conch’s visceral hump stays inside it and holds the internal organs, while the strong foot and head come out of the opening.',
      claim: 'part-conch-lip',
    },
  },
  'tiger-cowrie': {
    Mantle: {
      what: 'Two mantle lobes with short papillae.',
      use: 'They secrete the shell and spread right over it while the animal is active, keeping the shell smooth and glossy.',
      claim: 'mantle-coating-and-polish',
    },
  },
}

export function termFor(name: string, speciesId: string): Term | undefined {
  return bySpecies[speciesId]?.[name] ?? glossary[name]
}

export const speciesTerms = bySpecies
