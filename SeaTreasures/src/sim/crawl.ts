import type { Species } from './species.ts'

/**
 * How each animal gets about on the sea floor: snails creep slowly and
 * steadily on their muscular foot, and the nautilus drifts backwards, shell
 * first, as it does when it swims by jet propulsion.
 */
export type Gait = 'crawl' | 'swim'

export const gaitClaim: Record<Gait, string> = {
  crawl: 'mollusca-body-plan',
  swim: 'nautilus-buoyancy',
}

export function gaitFor(species: Pick<Species, 'group'>): Gait {
  return species.group === 'cephalopod' ? 'swim' : 'crawl'
}

/**
 * Speed along the route in body lengths per second: a slow, steady creep,
 * still faster than life (snails cover millimetres a minute) so it can be seen.
 */
const SPEED: Record<Gait, number> = { crawl: 0.03, swim: 0.035 }

/** How far along its route the animal has come after `seconds` of moving, in body lengths. */
export const travelled = (gait: Gait, seconds: number) => SPEED[gait] * seconds

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
