import test from 'node:test'
import assert from 'node:assert/strict'
import manifest from '../data/claims.json' with { type: 'json' }
import {
  along,
  gaitClaim,
  gaitFor,
  hop,
  routeLength,
  travelled,
} from '../src/sim/crawl.ts'
import { allSpecies } from '../src/sim/species.ts'

test('each animal moves the way its sources say', () => {
  const ids = new Set(manifest.claims.map((claim) => claim.id))
  for (const claim of Object.values(gaitClaim)) assert.ok(ids.has(claim), claim)
  const gaits = Object.fromEntries(allSpecies.map((s) => [s.id, gaitFor(s)]))
  assert.equal(gaits['tiger-cowrie'], 'glide')
  assert.equal(gaits['textile-cone'], 'glide')
  assert.equal(gaits['queen-conch'], 'leap')
  assert.equal(gaits['chambered-nautilus'], 'jet')
})

test('the route is a closed loop over the clear sand around the start', () => {
  const start = along(0)
  assert.ok(Math.hypot(start.x, start.z) < 1e-9)
  const end = along(routeLength)
  assert.ok(Math.hypot(end.x - start.x, end.z - start.z) < 1e-6)
  for (let d = 0; d < routeLength; d += 0.05) {
    const at = along(d)
    // The scenery keeps everything tall at least two body lengths away.
    assert.ok(Math.hypot(at.x, at.z) <= 1.05, `${d}`)
    // It faces the way it is going.
    const next = along(d + 0.01)
    const ahead = Math.atan2(-(next.z - at.z), next.x - at.x)
    const off = Math.abs(
      Math.atan2(Math.sin(ahead - at.heading), Math.cos(ahead - at.heading)),
    )
    assert.ok(off < 0.2, `heading at ${d}`)
  }
  // A nautilus swims backwards: shell first.
  const forward = along(1.3).heading
  const back = along(1.3, true).heading
  assert.ok(Math.abs(Math.cos(back - forward) + 1) < 1e-9)
})

test('a glide is steady, a leap comes in strokes and leaves the sand', () => {
  for (let s = 0; s < 20; s += 0.25)
    assert.ok(travelled('glide', s + 0.25) > travelled('glide', s))
  // A conch rests between leaps: no progress for a while after each one.
  assert.equal(travelled('leap', 1.0), travelled('leap', 2.0))
  assert.ok(travelled('leap', 2.9) > travelled('leap', 2.0))
  assert.ok(hop('leap', 0.27) > 0.05)
  assert.equal(hop('leap', 1.5), 0)
  assert.equal(hop('glide', 0.27), 0)
  // Slow: well under a body length every few seconds.
  for (const gait of ['glide', 'leap', 'jet'] as const)
    assert.ok(travelled(gait, 10) < 1, gait)
})
