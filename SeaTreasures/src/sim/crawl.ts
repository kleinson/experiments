import type { PhaseId } from './life.ts'
import type { Species } from './species.ts'

/**
 * How the animal moves at each stage of its life, from its sources:
 * - `crawl`: a snail creeping on waves of muscle along its foot.
 * - `vault`: the queen conch, which hops rather than crawls.
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
    return still([
      {
        text: 'It swims by beating the cilia on its velum, and pulls the velum in to sink.',
        claim: 'term-veliger-velum',
      },
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
          text: 'It does not crawl: it vaults. The pointed operculum digs into the sand and the foot throws the shell up and forward, leaving no continuous trail.',
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
/** A conch's vault, then a long rest, in seconds. */
const VAULT = { beat: 4, push: 0.9 }

/** How far along its route the animal has come after `seconds` of moving, in body lengths. */
export function travelled(mode: Mode, seconds: number) {
  if (mode === 'crawl' || mode === 'swim') return SPEED[mode] * seconds
  if (mode !== 'vault') return 0
  const perBeat = SPEED.vault * VAULT.beat
  const beats = Math.floor(seconds / VAULT.beat)
  const into = Math.min(1, (seconds - beats * VAULT.beat) / VAULT.push)
  return (beats + into * into * (3 - 2 * into)) * perBeat
}

/** How high a vault lifts the shell off the sand at `seconds`, in body lengths: barely. */
export function lift(mode: Mode, seconds: number) {
  if (mode !== 'vault') return 0
  const into = (seconds % VAULT.beat) / VAULT.push
  return into < 1 ? Math.sin(into * Math.PI) * 0.03 : 0
}

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
