import test from 'node:test'
import assert from 'node:assert/strict'
import manifest from '../data/claims.json' with { type: 'json' }
import {
  activity,
  along,
  grazing,
  hatchesTogether,
  lift,
  routeLength,
  sunk,
  travelled,
  travels,
} from '../src/sim/crawl.ts'
import { phases } from '../src/sim/life.ts'
import { allSpecies, getSpecies } from '../src/sim/species.ts'

const ids = new Set(manifest.claims.map((claim) => claim.id))
const mode = (
  id: string,
  phase: (typeof phases)[number]['id'],
  night = false,
) => activity(getSpecies(id), phase, night).mode

test('every movement fact rests on a claim that exists', () => {
  for (const species of allSpecies)
    for (const { id } of phases)
      for (const night of [false, true])
        for (const fact of activity(species, id, night).facts)
          assert.ok(ids.has(fact.claim), `${species.id} ${id}: ${fact.claim}`)
})

test('each stage moves as its sources say', () => {
  for (const species of allSpecies) {
    // Eggs, the dead and empty shells do not move by themselves.
    for (const phase of ['egg', 'death', 'remains', 'beach', 'found'] as const)
      assert.equal(mode(species.id, phase), 'still', `${species.id} ${phase}`)
  }
  // Snails crawl on their foot; the queen conch vaults instead.
  assert.equal(mode('money-cowrie', 'adult'), 'crawl')
  assert.equal(mode('money-cowrie', 'growth'), 'crawl')
  assert.equal(mode('queen-conch', 'adult'), 'vault')
  // Young conch stay buried their first year.
  assert.equal(mode('queen-conch', 'growth'), 'buried')
  // Night foragers rest by day and come out at night.
  assert.equal(mode('tiger-cowrie', 'adult'), 'hidden')
  assert.equal(mode('tiger-cowrie', 'adult', true), 'crawl')
  assert.equal(mode('textile-cone', 'adult'), 'buried')
  assert.equal(mode('textile-cone', 'adult', true), 'crawl')
  assert.ok(activity(getSpecies('textile-cone'), 'adult', false).wakesAtNight)
  // A nautilus rests by day and swims at night, shell first.
  assert.equal(mode('chambered-nautilus', 'adult'), 'hover')
  assert.equal(mode('chambered-nautilus', 'adult', true), 'swim')
  // A swimming veliger is explained in the larva stage.
  assert.ok(
    activity(getSpecies('tiger-cowrie'), 'larva', false).facts.some(
      (fact) => fact.claim === 'term-velum-why',
    ),
  )
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

test('crawling is slow and steady; a lunge stays on the sand and is followed by a rest', () => {
  // Swimming is steady.
  const step = travelled('swim', 0.5)
  for (let t = 0; t < 30; t += 0.5)
    assert.ok(
      Math.abs(travelled('swim', t + 0.5) - travelled('swim', t) - step) < 1e-9,
    )
  assert.equal(lift('swim', 0.3), 0)
  // A crawler moves, eases to a stop to graze, then sets off again: never backwards, never a jump.
  let previous = 0
  let maxStep = 0
  for (let t = 0.05; t < 60; t += 0.05) {
    const d = travelled('crawl', t)
    assert.ok(d >= previous - 1e-12)
    maxStep = Math.max(maxStep, d - previous)
    previous = d
  }
  assert.ok(maxStep <= 0.03 * 0.05 + 1e-9)
  assert.ok(
    grazing('crawl', 13) && !grazing('crawl', 5) && !grazing('swim', 13),
  )
  assert.equal(travelled('crawl', 12.5), travelled('crawl', 15.5))
  for (const gait of ['crawl', 'vault', 'swim'] as const) {
    assert.ok(travels(gait))
    // Well under a body length every ten seconds.
    assert.ok(travelled(gait, 10) < 0.6, gait)
  }
  for (const still of ['hover', 'hidden', 'buried', 'still'] as const) {
    assert.ok(!travels(still))
    assert.equal(travelled(still, 10), 0)
  }
  // The conch rests between lunges, and never leaves the sand.
  assert.equal(travelled('vault', 2), travelled('vault', 4))
  for (let s = 0; s < 10; s += 0.1) assert.equal(lift('vault', s), 0)
  assert.ok(sunk('buried') > 0.3)
  assert.equal(sunk('crawl'), 0)
})

test('only what changes with the time of day is told by day or by night', () => {
  const daily = (id: string, phase: 'growth' | 'adult') =>
    activity(getSpecies(id), phase, false).daily
  assert.ok(daily('tiger-cowrie', 'adult'))
  assert.ok(daily('textile-cone', 'adult'))
  assert.ok(daily('chambered-nautilus', 'adult'))
  assert.ok(!daily('queen-conch', 'growth'))
  assert.ok(!daily('queen-conch', 'adult'))
  assert.ok(!daily('money-cowrie', 'adult'))
})

test('sibling larvae drift only with species whose larvae hatch together', () => {
  for (const id of [
    'tiger-cowrie',
    'money-cowrie',
    'textile-cone',
    'queen-conch',
    'giant-clam',
  ]) {
    const fact = hatchesTogether(id)
    assert.ok(fact, `${id} should drift among siblings`)
    assert.ok(ids.has(fact.claim), `${id} cites missing ${fact.claim}`)
    assert.ok(
      activity(getSpecies(id), 'larva', false).facts.some(
        (f) => f.claim === fact.claim,
      ),
      `${id} larva should explain its siblings`,
    )
  }
  for (const id of [
    'chambered-nautilus',
    'fuzzy-chiton',
    'tusk-shell',
    'monoplacophoran',
  ])
    assert.equal(
      hatchesTogether(id),
      null,
      `${id} has no sourced brood of drifting larvae`,
    )
})
