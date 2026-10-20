import type { Species } from './species.ts'

/**
 * How each animal gets about on the sea floor, from its sources:
 * cowries and cones glide on a muscular foot, the queen conch leaps by
 * digging its operculum into the sand and throwing the shell forward, and
 * the nautilus swims backwards by jet propulsion.
 */
export type Gait = 'glide' | 'leap' | 'jet'

export const gaitClaim: Record<Gait, string> = {
  glide: 'cowrie-animal-anatomy',
  leap: 'part-conch-leap',
  jet: 'nautilus-buoyancy',
}

export function gaitFor(species: Pick<Species, 'id' | 'group'>): Gait {
  if (species.group === 'cephalopod') return 'jet'
  if (species.id === 'queen-conch') return 'leap'
  return 'glide'
}

/**
 * Speed along the route in body lengths per second. Far faster than life
 * (snails cover millimetres a minute), slowed only enough to watch.
 */
const SPEED: Record<Gait, number> = { glide: 0.05, leap: 0.06, jet: 0.07 }
/** A leap or jet stroke, then a rest, in seconds. */
const STROKE: Record<Gait, { beat: number; push: number }> = {
  glide: { beat: 1, push: 1 },
  leap: { beat: 2.6, push: 0.55 },
  jet: { beat: 1.8, push: 0.7 },
}

/**
 * How far along its route the animal has come after `seconds` of moving,
 * in body lengths. A glide is steady; a leap or jet comes in strokes.
 */
export function travelled(gait: Gait, seconds: number) {
  const { beat, push } = STROKE[gait]
  const perBeat = SPEED[gait] * beat
  const beats = Math.floor(seconds / beat)
  const into = Math.min(1, (seconds - beats * beat) / push)
  const stroke = gait === 'glide' ? into : into * into * (3 - 2 * into)
  return (beats + stroke) * perBeat
}

/** Height of a leap above the sand at `seconds`, in body lengths. */
export function hop(gait: Gait, seconds: number) {
  if (gait !== 'leap') return 0
  const { beat, push } = STROKE.leap
  const into = (seconds % beat) / push
  return into < 1 ? Math.sin(into * Math.PI) * 0.07 : 0
}

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
