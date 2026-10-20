import test from 'node:test'
import assert from 'node:assert/strict'
import manifest from '../data/claims.json' with { type: 'json' }
import { beds, seabedFor } from '../src/sim/seabed.ts'
import { placeLook, reefOf } from '../src/sim/places.ts'
import { depthFor } from '../src/sim/depth.ts'
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
  for (const id of Object.keys(reefOf))
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

test('every region has a sourced place profile and every species a sourced depth', () => {
  const ids = new Set(manifest.claims.map((claim) => claim.id))
  for (const region of ranges.regions) {
    assert.ok(reefOf[region.id], `${region.id} has a reef profile`)
    const look = placeLook(region.id)
    assert.ok(ids.has(look.claim), `${region.id} cites ${look.claim}`)
  }
  assert.equal(placeLook('bermuda').reef, 'pink-sand')
  assert.equal(placeLook('hawaiian-islands').fish.colour[0], 252)
  assert.ok(placeLook('seychelles').rock.length > 1, 'granite boulders')
  for (const species of allSpecies) {
    const depth = depthFor(species, species.origins[0]!.id)
    assert.ok(ids.has(depth.claim), `${species.id} depth cites ${depth.claim}`)
    assert.ok(depth.drawn >= depth.reach[0] && depth.drawn <= depth.reach[1])
  }
  const nautilus = getSpecies('chambered-nautilus')
  assert.equal(depthFor(nautilus, 'vanuatu').range?.[0], 5)
  assert.equal(depthFor(nautilus, 'philippines').range?.[0], 100)
  assert.equal(depthFor(getSpecies('tiger-cowrie'), 'red-sea').range?.[1], 40)
  const clamped = seabedFor(
    getSpecies('tiger-cowrie'),
    'red-sea',
    'adult',
    null,
    500,
  )
  assert.equal(clamped.depthM, 40)
  assert.equal(
    seabedFor(getSpecies('queen-conch'), 'bahamas', 'beach').depthM,
    0,
  )
})
