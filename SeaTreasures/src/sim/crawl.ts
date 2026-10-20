import type { PhaseId } from './life.ts'
import type { Species } from './species.ts'

/**
 * How the animal moves at each stage of its life, from its sources:
 * - `crawl`: a snail creeping on waves of muscle along its foot.
 * - `vault`: the queen conch, which moves in lunges (hops) rather than crawls.
 * - `swim`: a nautilus jetting backwards, shell first.
 * - `hover`: a nautilus resting in the water by day.
 * - `hidden`: resting out of sight by day, as a tiger cowrie does.
 * - `buried`: lying in the sand, as young conch and textile cones by day.
 * - `still`: eggs, larvae (steered by hand) and the dead.
 */
export type Mode =
  'crawl' | 'vault' | 'swim' | 'hover' | 'hidden' | 'buried' | 'still'

export type Fact = { text: string; claim: string }
export type Activity = {
  mode: Mode
  /** What it is doing now and how, each with its claim. */
  facts: Fact[]
  /** True when it rests by day but is active at night. */
  wakesAtNight: boolean
  /** True when what it does depends on the time of day. */
  daily: boolean
}

const crawling: Fact = {
  text: 'It crawls on waves of muscle that run along its foot, sliding on a thin film of mucus that also helps it grip.',
  claim: 'move-snail-crawl',
}
const settled: Fact = {
  text: 'Settled on the bottom, the young snail moves about the seabed on its foot.',
  claim: 'move-juvenile-foot',
}
const jetting: Fact = {
  text: 'It moves by squirting water through its funnel, thrusting itself backwards and turning; shell first is its most efficient way to swim fast.',
  claim: 'move-nautilus-jet',
}

/**
 * Species whose larvae hatch in great numbers at once, so a larva drifts among siblings
 * from the same brood or spawning. Others are left alone rather than guessed at.
 */
const HATCH_TOGETHER: Record<string, Fact> = {
  'tiger-cowrie': {
    text: 'It hatched with hundreds of siblings from each egg capsule, most of the brood in one night, so other veligers drift nearby.',
    claim: 'cowrie-hatch-together',
  },
  'money-cowrie': {
    text: 'Tropical cowries release many veligers from each egg capsule, so siblings from the same brood drift nearby.',
    claim: 'cowrie-hatch-together',
  },
  'textile-cone': {
    text: 'A cone egg mass holds thousands of eggs, so it drifts among many siblings.',
    claim: 'textile-cone-egg-genus',
  },
  'queen-conch': {
    text: 'One egg mass holds hundreds of thousands of eggs that hatch together after about five days, so siblings drift nearby.',
    claim: 'queen-conch-eggs',
  },
  'giant-clam': {
    text: 'One spawning releases hundreds of millions of eggs into the water, so countless sibling larvae drift together.',
    claim: 'giant-clam-spawning',
  },
}

/** Whether a species' larva drifts among siblings that hatched with it, and the claim for it. */
export const hatchesTogether = (speciesId: string): Fact | null =>
  HATCH_TOGETHER[speciesId] ?? null

/** What the living animal is doing, for a species at a stage, by day or by night. */
export function activity(
  species: Pick<Species, 'id' | 'group'>,
  phase: PhaseId,
  night: boolean,
): Activity {
  const still = (facts: Fact[] = []): Activity => ({
    mode: 'still',
    facts,
    wakesAtNight: false,
    daily: false,
  })
  const doing = (
    mode: Mode,
    facts: Fact[],
    wakesAtNight = false,
  ): Activity => ({ mode, facts, wakesAtNight, daily: false })
  const daily = (activity: Activity): Activity => ({ ...activity, daily: true })
  const cowrie = species.id === 'tiger-cowrie' || species.id === 'money-cowrie'
  if (phase === 'larva') {
    if (species.group === 'cephalopod') return still()
    const siblings = hatchesTogether(species.id)
    const among = siblings ? [siblings] : []
    if (species.id === 'giant-clam')
      return still([
        {
          text: 'A shelled, swimming veliger that feeds on microalgae; after about 6 to 14 days it grows a foot and settles.',
          claim: 'giant-clam-larva',
        },
        ...among,
      ])
    if (species.id === 'fuzzy-chiton')
      return still([
        {
          text: 'A chiton hatches as a trochophore that lives on its yolk and soon turns into a young chiton, with no veliger stage.',
          claim: 'fuzzy-chiton-larva',
        },
      ])
    if (species.id === 'tusk-shell')
      return still([
        {
          text: 'A trochophore becomes a shelled, swimming veliger, which settles on the bottom and grows into a miniature tusk shell.',
          claim: 'tusk-shell-larva',
        },
      ])
    if (species.id === 'monoplacophoran')
      return still([
        {
          text: 'How it develops is unknown: no one has studied a monoplacophoran larva.',
          claim: 'neopilina-unknowns',
        },
      ])
    return still([
      {
        text: 'It swims by beating the cilia on its velum, and can pull the velum into its shell for protection.',
        claim: 'term-velum-why',
      },
      ...among,
      ...(cowrie
        ? [
            {
              text: 'Near settling, a cowrie larva swims less and spends more time on the bottom, then starts to crawl.',
              claim: 'move-cowrie-settling',
            },
          ]
        : []),
    ])
  }
  if (phase !== 'growth' && phase !== 'adult') return still()
  const young = phase === 'growth'
  const moving = young ? settled : crawling
  switch (species.id) {
    case 'giant-clam':
      return young
        ? doing('still', [
            {
              text: 'A young clam crawls on its foot at first, then ties itself down with byssal threads.',
              claim: 'giant-clam-sessile',
            },
            {
              text: 'It filters plankton from the water with its gills, which matters most while it is small.',
              claim: 'giant-clam-filter-feeding',
            },
          ])
        : daily(
            night
              ? doing('still', [
                  {
                    text: 'At night its algae cannot photosynthesise; it keeps filtering plankton from the water.',
                    claim: 'giant-clam-filter-feeding',
                  },
                ])
              : doing('still', [
                  {
                    text: 'It never moves: by day it opens and spreads its mantle so the algae living in it get sunlight, and they feed it.',
                    claim: 'giant-clam-zooxanthellae',
                  },
                  {
                    text: 'Adults are held in place by their size and weight alone.',
                    claim: 'giant-clam-sessile',
                  },
                ]),
          )
    case 'fuzzy-chiton':
      return daily(
        night
          ? doing('crawl', [
              {
                text: 'At night it creeps over the rock, scraping algae off with its magnetite-capped teeth.',
                claim: 'fuzzy-chiton-feeding',
              },
            ])
          : doing(
              'hidden',
              [
                {
                  text: 'By day it clings to the rock with great force, sheltering from the heat.',
                  claim: 'fuzzy-chiton-clinging',
                },
                {
                  text: 'Hundreds of tiny eyes in its plates watch for shadows passing overhead.',
                  claim: 'fuzzy-chiton-eyes',
                },
              ],
              true,
            ),
      )
    case 'tusk-shell':
      return doing('still', [
        {
          text: 'It lives buried head-down in the sand; only the narrow end reaches into the water.',
          claim: 'tusk-shell-burrowing',
        },
        {
          text: 'Its thread-like captacula probe the sediment and carry tiny prey, mainly foraminifera, to the mouth.',
          claim: 'tusk-shell-captacula',
        },
        {
          text: 'It has no gills: water drawn in at the top is pushed back out about every 10 to 12 minutes.',
          claim: 'tusk-shell-breathing',
        },
      ])
    case 'monoplacophoran':
      return doing('still', [
        {
          text: 'On the abyssal mud it gathers detritus, radiolarians and diatoms with the tentacle tufts beside its mouth.',
          claim: 'neopilina-feeding',
        },
        {
          text: 'How fast or how far it moves has not been observed.',
          claim: 'neopilina-unknowns',
        },
      ])
    case 'chambered-nautilus':
      if (young) return doing('swim', [jetting])
      return daily(
        night
          ? doing('swim', [
              {
                text: 'At night it keeps on the move, between about 100 m and 700 m down.',
                claim: 'move-nautilus-day-night',
              },
              jetting,
            ])
          : doing(
              'hover',
              [
                {
                  text: 'By day it mostly rests, around 200 m down; at night it keeps on the move.',
                  claim: 'move-nautilus-day-night',
                },
                jetting,
              ],
              true,
            ),
      )
    case 'queen-conch':
      if (young)
        return doing('buried', [
          {
            text: 'A young conch usually stays buried in the sediment through its first year.',
            claim: 'move-conch-buried-young',
          },
        ])
      return doing('vault', [
        {
          text: 'It moves in short lunges rather than a smooth crawl: the pointed operculum digs into the sand and the foot throws the shell forward, leaving no continuous trail. In life each lunge is a quick hop; here it is slowed right down.',
          claim: 'move-conch-hops',
        },
      ])
    case 'textile-cone':
      return daily(
        night
          ? doing('crawl', [
              {
                text: 'At night it leaves the sand to feed.',
                claim: 'depth-textile-cone',
              },
              moving,
            ])
          : doing(
              'buried',
              [
                {
                  text: 'By day it lies buried in the sand, and comes out to feed at night.',
                  claim: 'depth-textile-cone',
                },
              ],
              true,
            ),
      )
    case 'tiger-cowrie':
      return daily(
        night
          ? doing('crawl', [
              {
                text: 'At night it comes out of hiding to forage.',
                claim: 'ecology-nocturnal-foraging',
              },
              moving,
            ])
          : doing(
              'hidden',
              [
                {
                  text: 'By day it rests hidden under rock or coral with its mantle drawn in, and forages at night.',
                  claim: 'ecology-nocturnal-foraging',
                },
              ],
              true,
            ),
      )
    case 'money-cowrie':
      return doing('crawl', [
        {
          text: 'It grazes on algae-covered rocks in broad daylight.',
          claim: 'money-cowrie-habitat-behavior',
        },
        moving,
      ])
    default:
      return species.group === 'cephalopod'
        ? doing('swim', [jetting])
        : doing('crawl', [moving])
  }
}

/** Modes that travel along the route. */
export const travels = (mode: Mode) =>
  mode === 'crawl' || mode === 'vault' || mode === 'swim'

/**
 * Speed along the route in body lengths per second: slow and steady, still
 * faster than life (snails cover millimetres a minute) so it can be seen.
 */
const SPEED = { crawl: 0.03, vault: 0.04, swim: 0.035 }
/** A conch's lunge, then a long rest, in seconds. Slowed right down: in life each is a quick hop. */
const VAULT = { beat: 4.5, push: 1.6 }

/** How far along its route the animal has come after `seconds` of moving, in body lengths. */
/** A crawler moves on for a while, then stops to graze, in seconds. */
const GRAZE = { cycle: 16, moving: 11 }

/** True while a crawling animal has stopped to feed. */
export const grazing = (mode: Mode, seconds: number) =>
  mode === 'crawl' && seconds % GRAZE.cycle > GRAZE.moving

export function travelled(mode: Mode, seconds: number) {
  if (mode === 'crawl') {
    // Moves, eases to a stop, grazes, sets off again: never a jump in speed.
    const cycles = Math.floor(seconds / GRAZE.cycle)
    const into = seconds - cycles * GRAZE.cycle
    const ease = 1.2
    const moving =
      into < GRAZE.moving
        ? into - Math.max(0, into - (GRAZE.moving - ease)) ** 2 / (2 * ease)
        : GRAZE.moving - ease / 2
    return SPEED.crawl * (cycles * (GRAZE.moving - ease / 2) + moving)
  }
  if (mode === 'swim') return SPEED[mode] * seconds
  if (mode !== 'vault') return 0
  const perBeat = SPEED.vault * VAULT.beat
  const beats = Math.floor(seconds / VAULT.beat)
  const into = Math.min(1, (seconds - beats * VAULT.beat) / VAULT.push)
  return (beats + into * into * (3 - 2 * into)) * perBeat
}

/** The shell stays on the sand: no animal here is shown leaving the bottom. */
export const lift = (_mode: Mode, _seconds: number) => 0

/** How much of its height is under the sand. */
export const sunk = (mode: Mode) => (mode === 'buried' ? 0.45 : 0)

/**
 * A slow figure of eight over the flat sand around where the animal was
 * first drawn, through that spot; the scenery keeps this patch clear.
 */
const REACH = { x: 0.95, z: 0.45 }
const point = (s: number) => ({
  x: REACH.x * Math.sin(s),
  z: -REACH.z * Math.sin(2 * s),
})
const STEPS = 720
const table = (() => {
  const out = [0]
  let previous = point(0)
  for (let i = 1; i <= STEPS; i++) {
    const next = point((i / STEPS) * Math.PI * 2)
    out.push(out[i - 1]! + Math.hypot(next.x - previous.x, next.z - previous.z))
    previous = next
  }
  return out
})()
export const routeLength = table[STEPS]!

/**
 * Where the animal is after `distance` body lengths: its offset from the
 * start in body lengths, and which way it faces (radians about +y; 0 is +x).
 */
export function along(distance: number, backwards = false) {
  const d = ((distance % routeLength) + routeLength) % routeLength
  let low = 0
  let high = STEPS
  while (high - low > 1) {
    const mid = (low + high) >> 1
    if (table[mid]! <= d) low = mid
    else high = mid
  }
  const part = (d - table[low]!) / (table[high]! - table[low]! || 1)
  const s = ((low + part) / STEPS) * Math.PI * 2
  const at = point(s)
  const vx = REACH.x * Math.cos(s)
  const vz = -2 * REACH.z * Math.cos(2 * s)
  // A turn about +y by θ carries +x to (cos θ, 0, −sin θ).
  const heading = Math.atan2(-vz, vx) + (backwards ? Math.PI : 0)
  return { x: at.x, z: at.z, heading }
}
