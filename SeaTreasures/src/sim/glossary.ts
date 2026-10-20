/**
 * One labelled part, explained as a TL;DR: what it is, why the animal has it
 * and how it works, together in two or three sentences. `what` is a short
 * name-level line for under the title. Every sentence of `tldr` comes from the
 * cited claims, the main one first; where a source says nothing about why or
 * how, the entry does not guess.
 */
export type Term = { what: string; tldr: string; claims: string[] }

/**
 * What each label in the figure means. Some parts work differently in
 * different animals, so a species can have its own entry (see `termFor`).
 */
export const glossary: Record<string, Term> = {
  Apex: {
    what: 'The tip of the spire.',
    tldr: 'The apex is the protoconch, the first shell the animal built as an embryo or larva. Every later whorl was added on from it, so it is the oldest part of the shell; in some snails it dissolves once the juvenile shell has formed.',
    claims: ['part-protoconch', 'term-gastropod-shell-parts'],
  },
  Aperture: {
    what: 'The main opening of the shell.',
    tldr: 'The aperture is the shell’s main opening, where the head and foot come out and are pulled back in. It is also where the shell grows: the edge of the mantle lays thin new layers on its rim, so the opening is always the newest part.',
    claims: ['part-aperture', 'part-columella', 'shell-mantle-secretes'],
  },
  'Body whorl': {
    what: 'The last and largest turn of the coil.',
    tldr: 'The body whorl is the last and largest turn of the coil, and it ends at the opening. The shell only grows at that edge, so every earlier, smaller whorl is the shell as it was when the animal was younger.',
    claims: ['term-gastropod-shell-parts', 'shell-mantle-secretes'],
  },
  Columella: {
    what: 'The central pillar the coil turns around.',
    tldr: 'The columella is the central pillar the shell coils around. The columellar muscle is anchored along it: contracting that muscle pulls the foot and head into the shell, away from predators and drying out, and draws the operculum shut.',
    claims: ['part-columella', 'term-gastropod-shell-parts'],
  },
  'Thick lip': {
    what: 'The flared outer lip of the opening.',
    tldr: 'The queen conch’s flared lip only starts to grow once it reaches breeding age; juveniles have none. It keeps thickening from then on, so the thicker the lip, the older the conch.',
    claims: ['part-conch-lip'],
  },
  'Toothed aperture': {
    what: 'A narrow, tooth-lined opening underneath.',
    tldr: 'This narrow, tooth-lined opening forms only when a cowrie matures and its outer lip curls inward and thickens; a juvenile’s opening is wide and thin-lipped. From then on the shell stops getting longer and grows mainly in width and thickness.',
    claims: [
      'aperture-teeth-at-maturity',
      'length-finalized-at-maturity',
      'cowrie-juvenile-bulla-to-adult',
    ],
  },
  Dorsum: {
    what: 'The domed back of the shell.',
    tldr: 'The dorsum is the domed back of a cowrie shell. While the animal is active its mantle spreads over it and lays down new outer shell material, which is why a living cowrie stays so smooth and glossy.',
    claims: ['mantle-coating-and-polish', 'cowrie-mantle-gloss-layer'],
  },
  'Young spire': {
    what: 'The coil of a juvenile cowrie.',
    tldr: 'A young cowrie still has a thin, visibly coiled shell, much like a small olive shell. As it matures its last whorl grows over and encloses all the earlier ones, hiding the spiral inside the smooth adult shell.',
    claims: ['juvenile-to-adult-shape-change', 'cowrie-inner-whorls'],
  },
  Mantle: {
    what: 'The soft body wall over the organs.',
    tldr: 'The mantle is the soft body wall over the organs, and it builds the shell: its cells secrete proteins and calcium carbonate that harden into new shell at the growing edge. It also encloses the mantle cavity used for breathing, and in cowries it spreads out over the shell itself.',
    claims: ['part-mantle', 'material-shell-secretion', 'mollusca-body-plan'],
  },
  'Visceral mass': {
    what: 'The organs coiled up inside the whorls.',
    tldr: 'The visceral mass is the body’s organs, coiled up inside the shell’s whorls: gonad, digestive gland, heart, kidney and part of the gut. The gill sits apart in the mantle cavity, where water is drawn in over it to breathe.',
    claims: ['gastropod-internal-anatomy', 'part-siphon'],
  },
  Foot: {
    what: 'The single muscular foot under the body.',
    tldr: 'The foot is a single muscular sole under the body; “gastropod” means stomach-foot, because it lies beneath the guts. The snail crawls on it as waves of muscle run along the sole over a thin layer of mucus, which lets it grip and slide at once.',
    claims: ['part-gastropod-head-foot', 'move-snail-crawl'],
  },
  Tentacle: {
    what: 'A sensory tentacle on the head.',
    tldr: 'Snails carry two or four sensory tentacles on the head, with eyes on or beside them. Many also smell their surroundings through receptors in the tentacle skin.',
    claims: ['part-gastropod-head-foot', 'cowrie-animal-anatomy'],
  },
  'Eye stalk': {
    what: 'One of two long eye stalks.',
    tldr: 'The queen conch has two long eye stalks, each with a well-developed eye, and they move independently. Extra sensory tentacles sit beside them.',
    claims: ['part-conch-body', 'queen-conch-appearance'],
  },
  Proboscis: {
    what: 'The long, tube-like snout.',
    tldr: 'The proboscis is the queen conch’s long, tube-like snout. It uses it to browse algae and plant material in seagrass beds and to scavenge decaying plants; like most molluscs it feeds with a radula, a ribbon of tiny teeth that scrapes food before it is swallowed.',
    claims: ['part-conch-body', 'part-radula', 'mollusca-body-plan'],
  },
  Operculum: {
    what: 'A hard plate on the foot.',
    tldr: 'The operculum is a hard plate on top of the foot that works as a trapdoor. When the animal pulls back in, it closes the opening, above all to stop the snail drying out, and where it seals fully, against predators too.',
    claims: ['part-operculum', 'part-columella'],
  },
  Siphon: {
    what: 'A soft tube at the front of the opening.',
    tldr: 'The siphon is a tube-like fold of the mantle at the front of the opening. It draws water into the mantle cavity and over the gill to breathe, and its chemoreceptors “smell” or “taste” the water to find food.',
    claims: ['part-siphon', 'cowrie-animal-anatomy'],
  },
  'Banded siphon': {
    what: 'The black-and-red banded siphon.',
    tldr: 'The textile cone’s siphon is a black-and-red banded tube of the mantle that draws water into the mantle cavity and over the gill to breathe. Its chemoreceptors “taste” the water, which helps this cone hunt the other molluscs it feeds on.',
    claims: [
      'part-siphon',
      'textile-cone-size-pattern',
      'textile-cone-diet-behavior',
    ],
  },
  Septum: {
    what: 'A thin wall across the coil.',
    tldr: 'A septum is a thin wall across the nautilus’s coil that seals off an old chamber. As the nautilus grows it moves forward into a new living chamber and builds a septum behind it, each pierced in the middle by the siphuncle.',
    claims: ['term-nautilus-chambers'],
  },
  Siphuncle: {
    what: 'A strand of tissue through every chamber.',
    tldr: 'The siphuncle is a tube of tissue running through every chamber, and it is how the nautilus controls its buoyancy. It empties water from new chambers by making the blood inside it saltier, so water leaves by osmosis and gas diffuses in; it works passively, not by pumping.',
    claims: ['part-siphuncle', 'nautilus-buoyancy'],
  },
  'Living chamber': {
    what: 'The newest, largest chamber.',
    tldr: 'The living chamber is the newest and largest chamber, and the whole animal lives in it. Behind it, the older sealed chambers and the tube through them are what the nautilus uses to control its buoyancy.',
    claims: ['nautilus-buoyancy', 'term-nautilus-chambers'],
  },
  Hood: {
    what: 'A leathery lid over the opening.',
    tldr: 'The hood is a leathery lid formed from two folded tentacles. When the nautilus withdraws fully into its shell, the hood closes the opening behind it.',
    claims: ['term-nautilus-chambers'],
  },
  Tentacles: {
    what: '50 to over 90 slender tentacles.',
    tldr: 'A nautilus has 50 to over 90 tentacles of three kinds: ocular ones beside the eyes for sensing, and digital and labial ones ringing the mouth. They have no suckers; the digital tentacles grip with an adhesive from ridges on their surface and let go by contracting.',
    claims: ['part-nautilus-tentacles'],
  },
  Funnel: {
    what: 'The funnel, or hyponome.',
    tldr: 'The funnel, or hyponome, is how the nautilus swims: it draws water into its living chamber and squirts it out through the funnel. The jet thrusts it backwards and turns it, more efficiently than squid or jellyfish manage.',
    claims: ['part-nautilus-funnel', 'move-nautilus-jet'],
  },
  'Egg capsule': {
    what: 'A protective case around the eggs.',
    tldr: 'Nearly all molluscs lay eggs; cone snails, for example, lay them in capsules attached to the seabed. Depending on the group they hatch as swimming larvae or as miniature adults.',
    claims: ['mollusca-larvae', 'textile-cone-egg-genus'],
  },
  Velum: {
    what: 'Two thin, wing-like lobes on the larva’s head.',
    tldr: 'The velum is two thin, wing-like lobes on the larva’s head that let it swim and feed while it drifts in the plankton, which can carry it far from where it hatched. Long cilia round the rim beat to drive a current; food caught between them and a band of shorter cilia is passed along a groove to the mouth. It can be pulled into the shell for safety and is lost when the larva settles.',
    claims: ['term-velum-why', 'term-velum-how'],
  },
  'Ciliated band': {
    what: 'Long cilia round each lobe, short ones inside.',
    tldr: 'Each lobe of the velum is rimmed by a band of long cilia with a band of shorter cilia just inside it. The long cilia beat to drive the water current the larva swims and feeds by; particles in it are caught between the two bands and passed along the food groove to the mouth.',
    claims: ['term-velum-how'],
  },
  'Larval shell': {
    what: 'The first, larval shell.',
    tldr: 'The larval shell, or protoconch, is the first shell, built by the embryo or larva. The adult shell later grows on from its rim, so it stays as the tip of the spire; in some snails it dissolves.',
    claims: ['part-protoconch', 'term-gastropod-shell-parts'],
  },
  Valve: {
    what: 'One of the two halves of a bivalve shell.',
    tldr: 'A bivalve’s shell is two valves joined along a hinge. In the giant clam they are thick and heavy, with four to six deep folds ending in big triangular points, and adults cannot close them completely.',
    claims: ['bivalve-parts', 'giant-clam-appearance'],
  },
  Hinge: {
    what: 'Where the two valves are joined.',
    tldr: 'The two valves are joined here by a flexible ligament, usually with interlocking teeth. The ligament works as a spring: it pushes the valves open whenever the muscles that close them relax.',
    claims: ['bivalve-parts'],
  },
  'Adductor muscle': {
    what: 'The muscle that pulls the valves shut.',
    tldr: 'The adductor muscle runs between the two valves and pulls them shut. When it relaxes, the springy hinge ligament opens the shell again.',
    claims: ['bivalve-parts'],
  },
  Gill: {
    what: 'A gill, for breathing.',
    tldr: 'Gills take oxygen from the water. In bivalves they also filter food: the giant clam strains plankton with its gills, which matters most while it is small.',
    claims: ['bivalve-parts', 'giant-clam-filter-feeding'],
  },
  Girdle: {
    what: 'The tough muscular band around the plates.',
    tldr: 'The girdle is a tough, muscular band that holds a chiton’s eight plates. In the fuzzy chiton it is thick and densely spiky, usually with a few dark bands, and with the foot it clamps the animal to the rock.',
    claims: [
      'chiton-parts',
      'fuzzy-chiton-appearance',
      'fuzzy-chiton-clinging',
    ],
  },
  Plate: {
    what: 'One of the chiton’s eight shell plates.',
    tldr: 'A chiton’s shell is eight jointed plates rather than one piece. The joints let it bend over uneven rock and roll into a ball if it is knocked loose; in adult fuzzy chitons the plates are usually heavily eroded.',
    claims: [
      'chiton-parts',
      'fuzzy-chiton-clinging',
      'fuzzy-chiton-appearance',
    ],
  },
  'Shell eyes': {
    what: 'Hundreds of tiny eyes set in the plates.',
    tldr: 'The fuzzy chiton has hundreds of tiny eyes in its shell plates, each with a lens made of the mineral aragonite. They work as small camera eyes, in air and in water: the chiton reacts to a dark shape overhead but not to light simply dimming.',
    claims: ['fuzzy-chiton-eyes'],
  },
  Radula: {
    what: 'A ribbon of tiny teeth in the mouth.',
    tldr: 'The radula is a ribbon of tiny teeth that scrapes food before it is swallowed. A chiton’s teeth are capped with magnetite, an iron mineral, so they stay sharp scraping algae off rock, and new rows grow within days.',
    claims: ['part-radula', 'fuzzy-chiton-feeding'],
  },
  'Tusk shell': {
    what: 'A tapering tube open at both ends.',
    tldr: 'A tusk shell is a slightly curved tube, open at both ends, shaped like an elephant’s tusk. The animal lives in it head-down in the sand: the wide end digs, and only the narrow end reaches up into the water.',
    claims: [
      'scaphopod-parts',
      'tusk-shell-appearance',
      'tusk-shell-burrowing',
    ],
  },
  'Narrow end': {
    what: 'The small opening that reaches into the water.',
    tldr: 'The narrow end is the only part that sticks out of the sand. Tusk shells have no gills: water comes in here and the mantle absorbs its oxygen, then the water is pushed back out the same way about every 10 to 12 minutes.',
    claims: ['tusk-shell-breathing', 'tusk-shell-burrowing'],
  },
  Captacula: {
    what: 'Thread-like, club-tipped feeding tentacles.',
    tldr: 'Captacula are many thread-like tentacles with club-shaped tips around the head. They probe the sediment and carry tiny prey, mainly foraminifera, to the mouth, where a large radula grinds it.',
    claims: ['tusk-shell-captacula', 'scaphopod-parts'],
  },
  'Cap shell': {
    what: 'A single, thin, cap-shaped shell.',
    tldr: 'Neopilina has one thin, almost circular shell like a cap, its tip near the front edge. It is dull brown, nearly black at the tip and straw-coloured at the rim, with fine growth lines and faint radial ribs, and often corroded.',
    claims: ['neopilina-appearance', 'monoplacophoran-parts'],
  },
  'Mouth tentacles': {
    what: 'Tufts of tentacles beside the mouth.',
    tldr: 'Behind the mouth are tufts of tentacles. Food found in the guts of the first animals, mostly radiolarians, diatoms and detritus, suggests they gather it from the deep-sea mud, so Neopilina is thought to be a deposit feeder.',
    claims: ['neopilina-feeding'],
  },
  'Hermit crab': {
    what: 'A crab living in the empty shell.',
    tldr: 'A hermit crab’s abdomen is soft and not hardened by calcium, so it must live in a shell made by another animal or be defenceless. Almost 800 species carry such mobile homes, most often empty snail shells, and these shells are shared with hundreds of other small species too.',
    claims: ['part-hermit-crab', 'hermit-crab-shell-reuse'],
  },
  'Drill hole': {
    what: 'A neat round hole in the shell.',
    tldr: 'A neat, countersunk hole like this is the mark of a moon snail, which ploughs through sand hunting shellfish and bores through their shells to reach the animal inside. Rolling in the waves can also wear holes that look much the same.',
    claims: ['part-naticid-drilling', 'wave-abrasion-holes'],
  },
  'Broken lip': {
    what: 'Chips in the shell’s edge.',
    tldr: 'A chipped, broken edge is damage to the shell. Predators such as crabs, octopuses, birds and predatory snails can leave damage and holes in mollusc shells, and rolling in the waves wears shells down too.',
    claims: ['predator-drill-holes', 'wave-abrasion-holes'],
  },
  Intruder: {
    what: 'What a pearl starts from.',
    tldr: 'A pearl usually starts with a parasite, a scrap of organic matter or an injury that carries cells of the mantle’s outer layer into the soft body. Despite the common belief, it is rarely a grain of sand.',
    claims: ['pearl-natural-formation', 'pearl-not-sand'],
  },
  'Pearl sac': {
    what: 'The pocket of mantle cells that makes the pearl.',
    tldr: 'The displaced mantle cells close into a pocket, the pearl sac. It coats the intruder with calcium carbonate and the protein conchiolin, as the mantle builds the shell, and grows by cell division as the pearl grows.',
    claims: ['pearl-natural-formation', 'pearl-concentric-layers'],
  },
  'Growth layers': {
    what: 'Concentric layers, oldest at the centre.',
    tldr: 'A pearl is laid down in concentric layers around its starting point, so the centre is the oldest part and the skin the newest; an X-ray of a natural pearl shows these growth rings. They are drawn much wider and fewer here than in life.',
    claims: ['pearl-concentric-layers'],
  },
  Pearl: {
    what: 'A pearl, grown inside the soft body.',
    tldr: 'A pearl is calcium carbonate laid down in concentric layers by a pocket of mantle cells, the pearl sac. All shelled molluscs can make some kind of pearl, but most are not gems; the lustrous nacreous ones come mainly from pearl oysters and freshwater mussels.',
    claims: [
      'pearl-concentric-layers',
      'pearl-natural-formation',
      'pearl-any-mollusc',
    ],
  },
  'Blister pearl': {
    what: 'A pearl that grew fixed to the shell.',
    tldr: 'A blister pearl grows against the inside of the shell and is joined to it, so it has to be cut from the shell. The giant clam’s Pearl of Allah is one.',
    claims: ['giant-clam-pearl-sizes'],
  },
}

/** Where a species uses a part its own way, its sourced entry replaces the general one. */
const bySpecies: Record<string, Record<string, Term>> = {
  'giant-clam': {
    Mantle: {
      what: 'The mantle, spread out in the sun.',
      tldr: 'The giant clam farms single-celled algae in its mantle. By day it opens and spreads the mantle, olive to golden brown with brilliant blue-green rings, so the algae get sunlight; they pass sugars to the clam and supply most of its food.',
      claims: ['giant-clam-zooxanthellae', 'giant-clam-appearance'],
    },
    Siphon: {
      what: 'The opening where water is drawn in.',
      tldr: 'Water is drawn in through this opening in the mantle and over the gills, which take oxygen from it and filter out plankton. Many bivalves pump water through siphons like this.',
      claims: ['bivalve-parts', 'giant-clam-filter-feeding'],
    },
    Pearl: {
      what: 'A giant clam pearl: porcelain-like, not nacreous.',
      tldr: 'Giant clam pearls have no nacre, so they lack the rainbow sheen of oyster pearls. They are built of crossed aragonite lamellae that show a ‘flame structure’ and sometimes a silky shimmer, and most seem to turn as they grow.',
      claims: ['giant-clam-pearl-kind', 'giant-clam-pearl-rotation'],
    },
    'Blister pearl': {
      what: 'A pearl that grew fixed to the shell.',
      tldr: 'A blister pearl grows against the inside of the shell and is joined to it. The Pearl of Lao Tzu, 24 cm across and 6.4 kg, is one: it was cut from a giant clam’s shell.',
      claims: ['giant-clam-pearl-sizes', 'giant-clam-pearl-lao-tzu'],
    },
  },
  'fuzzy-chiton': {
    Foot: {
      what: 'The broad muscular foot underneath.',
      tldr: 'Most of a chiton’s underside is a broad muscular foot. It creeps on it and, with the girdle, clings to rock very powerfully, like a limpet; a row of small gills runs along each side of it.',
      claims: ['chiton-parts', 'fuzzy-chiton-clinging'],
    },
  },
  'tusk-shell': {
    Foot: {
      what: 'The digging foot at the wide end.',
      tldr: 'The muscular foot comes out of the wide end, down in the sediment. To dig, it pushes the foot out, spreads its tip to anchor it, then pulls the shell along after it.',
      claims: ['tusk-shell-burrowing', 'scaphopod-parts'],
    },
    Mantle: {
      what: 'The mantle lining the tube.',
      tldr: 'The mantle forms a tube inside the shell. With no gills, the tusk shell breathes through it: cilia move water along the mantle, whose surface takes up oxygen.',
      claims: ['scaphopod-parts', 'tusk-shell-breathing'],
    },
  },
  monoplacophoran: {
    Foot: {
      what: 'The round foot under the cap.',
      tldr: 'Under the cap is a round, muscular foot. Five pairs of gills sit in the groove beside it, and its muscles and kidneys are repeated in series, which surprised zoologists when Neopilina was described.',
      claims: ['neopilina-serial-organs', 'monoplacophoran-parts'],
    },
    'Larval shell': {
      what: 'A tiny coiled shell at the tip.',
      tldr: 'One of the first specimens still carried a tiny coiled larval shell at the tip of its cap. Beyond that, how Neopilina develops and how long it lives are unknown.',
      claims: ['neopilina-unknowns'],
    },
  },
  'queen-conch': {
    Foot: {
      what: 'A large, powerful foot.',
      tldr: 'The queen conch’s large, powerful foot moves it about, but not by crawling: it digs the point of its operculum into the sand, extends the foot and throws the shell forward. Only the front third touches the ground, and hopping may stop predators following a continuous scent trail.',
      claims: ['part-conch-leap', 'move-conch-hops'],
    },
    Operculum: {
      what: 'A brown, sickle-shaped operculum.',
      tldr: 'The conch’s operculum is a brown, sickle-shaped plate on its foot. Besides closing the opening when the conch withdraws, its point is dug into the sand like a vaulting pole to throw the shell forward.',
      claims: ['part-conch-leap', 'queen-conch-appearance', 'part-operculum'],
    },
    'Body whorl': {
      what: 'The last and largest turn of the coil.',
      tldr: 'The body whorl is the conch’s last and largest turn of the coil, ending at the opening. The visceral hump holding the internal organs stays inside it, while the strong foot and head come out of the opening.',
      claims: [
        'part-conch-lip',
        'term-gastropod-shell-parts',
        'part-conch-body',
      ],
    },
  },
  'tiger-cowrie': {
    Mantle: {
      what: 'Two mantle lobes with short papillae.',
      tldr: 'The tiger cowrie’s mantle is two lobes patterned with short papillae, and it secretes the shell. While the animal is active the lobes spread right over the shell and lay down new outer material, keeping it smooth and glossy.',
      claims: [
        'cowrie-animal-anatomy',
        'mantle-coating-and-polish',
        'cowrie-mantle-gloss-layer',
      ],
    },
    'Egg capsule': {
      what: 'A protective case around the eggs.',
      tldr: 'The tiger cowrie lays its eggs in a mass of capsules, and the mother sits over it for 7 to 17 days, until the larvae hatch. They hatch as free-swimming veliger larvae.',
      claims: ['tiger-cowrie-brooding', 'tiger-cowrie-larva-unresolved'],
    },
  },
}

export function termFor(name: string, speciesId: string): Term | undefined {
  return bySpecies[speciesId]?.[name] ?? glossary[name]
}

export const speciesTerms = bySpecies
