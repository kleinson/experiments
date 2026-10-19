import test from 'node:test'
import assert from 'node:assert/strict'
import manifest from '../data/claims.json' with { type: 'json' }
import { beds, coastOf, seabedFor } from '../src/sim/seabed.ts'
import { allSpecies, getSpecies } from '../src/sim/species.ts'
import { ranges } from '../src/sim/ranges.ts'

test('every species gets a seabed read from its sourced habitat', () => {
  const main = (id: string, region: string) =>
    seabedFor(getSpecies(id), region, 'adult').main
  assert.equal(main('tiger-cowrie', 'red-sea'), 'coral')
  assert.equal(main('money-cowrie', 'red-sea'), 'rock')
  assert.equal(main('queen-conch', 'cuba'), 'seagrass')
  assert.equal(main('chambered-nautilus', 'philippines'), 'deep')
  const cone = seabedFor(getSpecies('textile-cone'), 'red-sea', 'adult')
  assert.ok(cone.mix.sand && cone.mix.rubble, 'sand pockets and dead coral')
  for (const species of allSpecies)
    for (const phase of ['egg', 'growth', 'adult', 'remains'] as const) {
      const setting = seabedFor(species, 'red-sea', phase)
      const total = Object.values(setting.mix).reduce((a, b) => a + b, 0)
      assert.ok(Math.abs(total - 1) < 0.01, `${species.id} ${phase}`)
    }
})

test('the place changes the seabed: volcanic islands, seagrass and kelp coasts', () => {
  const tiger = getSpecies('tiger-cowrie')
  const reef = seabedFor(tiger, 'red-sea', 'adult')
  const hawaii = seabedFor(tiger, 'hawaiian-islands', 'adult')
  assert.notEqual(reef.key, hawaii.key)
  assert.ok((hawaii.mix.rock ?? 0) > 0, 'volcanic rock at Hawaii')
  const cone = seabedFor(
    getSpecies('textile-cone'),
    'gulf-of-california',
    'adult',
  )
  assert.ok((cone.mix.kelp ?? 0) > 0, 'brown algae in the Gulf of California')
  for (const id of Object.keys(coastOf))
    assert.ok(
      ranges.regions.some((region) => region.id === id),
      `${id} is a known region`,
    )
})

test('life stages move the scene: open water for larvae, sand on the beach', () => {
  const conch = getSpecies('queen-conch')
  assert.equal(seabedFor(conch, 'bahamas', 'larva').scene, 'open-water')
  assert.deepEqual(seabedFor(conch, 'bahamas', 'larva').mix, {})
  assert.equal(seabedFor(conch, 'bahamas', 'beach').scene, 'beach')
  assert.equal(seabedFor(conch, 'bahamas', 'found').main, 'sand')
  // The nautilus hatches as a small adult, so it stays on its deep slope.
  const nautilus = getSpecies('chambered-nautilus')
  assert.equal(seabedFor(nautilus, 'ambon', 'larva').scene, 'seabed')
})

test('a picked bed is drawn but flagged when it is not the species habitat', () => {
  const nautilus = getSpecies('chambered-nautilus')
  const kelp = seabedFor(nautilus, 'ambon', 'adult', 'kelp')
  assert.deepEqual(kelp.mix, { kelp: 1 })
  assert.equal(kelp.elsewhere, true)
  assert.equal(seabedFor(nautilus, 'ambon', 'adult', 'deep').elsewhere, false)
  assert.equal(beds.length, 7)
  const claim = manifest.claims.find(
    (item) => item.id === 'seabed-setting-illustrative',
  )
  assert.equal(claim?.scope, 'demo-limitation')
})
