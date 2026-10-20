import test from 'node:test'
import assert from 'node:assert/strict'
import manifest from '../data/claims.json' with { type: 'json' }
import {
  along,
  gaitClaim,
  gaitFor,
  routeLength,
  travelled,
} from '../src/sim/crawl.ts'
import { allSpecies } from '../src/sim/species.ts'

test('each animal moves the way its sources say', () => {
  const ids = new Set(manifest.claims.map((claim) => claim.id))
  for (const claim of Object.values(gaitClaim)) assert.ok(ids.has(claim), claim)
  const gaits = Object.fromEntries(allSpecies.map((s) => [s.id, gaitFor(s)]))
  for (const id of [
    'tiger-cowrie',
    'money-cowrie',
    'textile-cone',
    'queen-conch',
  ])
    assert.equal(gaits[id], 'crawl', id)
  assert.equal(gaits['chambered-nautilus'], 'swim')
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

test('every animal creeps slowly and steadily, without jumps', () => {
  for (const gait of ['crawl', 'swim'] as const) {
    const step = travelled(gait, 0.5)
    for (let s = 0; s < 30; s += 0.5)
      assert.ok(
        Math.abs(travelled(gait, s + 0.5) - travelled(gait, s) - step) < 1e-9,
        gait,
      )
    // Slow: well under half a body length every ten seconds.
    assert.ok(travelled(gait, 10) < 0.5, gait)
  }
})
