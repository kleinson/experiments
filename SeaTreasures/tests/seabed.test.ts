import test from 'node:test'
import assert from 'node:assert/strict'
import manifest from '../data/claims.json' with { type: 'json' }
import { beds, seabedFor } from '../src/sim/seabed.ts'
import { placeLook, reefOf } from '../src/sim/places.ts'
import { localForm } from '../src/sim/forms.ts'
import { shellsAt } from '../src/sim/ranges.ts'
import { depthFor } from '../src/sim/depth.ts'
import { allSpecies, getSpecies } from '../src/sim/species.ts'
import { ranges } from '../src/sim/ranges.ts'
import { nestFor, onRock } from '../src/sim/nests.ts'

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
      assert.ok(
        setting.scene === 'open-water'
          ? total === 0
          : Math.abs(total - 1) < 0.01,
        `${species.id} ${phase}`,
      )
    }
})

test('egg settings follow sourced laying sites rather than a generic sand bed', () => {
  const ids = new Set(manifest.claims.map((claim) => claim.id))
  for (const species of allSpecies) {
    const { kind, fact } = nestFor(species.id)
    if (fact) assert.ok(ids.has(fact.claim), species.id)
    const setting = seabedFor(species, 'philippines', 'egg')
    assert.equal(setting.scene, kind === 'water' ? 'open-water' : 'seabed')
    if (onRock(kind) && setting.depthM <= 60)
      assert.ok(setting.mix.rubble && setting.mix.rock, species.id)
  }
  const conch = seabedFor(getSpecies('queen-conch'), 'cuba', 'egg')
  assert.equal(conch.main, 'sand')
  assert.equal(nestFor('tiger-cowrie').kind, 'brood')
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

test('each place has its own shells, and Hawaii its own tiger cowrie', () => {
  const ids = allSpecies.map((species) => species.id)
  const bahamas = shellsAt('bahamas', ids).map((item) => item.speciesId)
  assert.equal(bahamas[0], 'queen-conch')
  assert.ok(!bahamas.includes('money-cowrie'))
  const hawaii = shellsAt('hawaiian-islands', ids).map((item) => item.speciesId)
  assert.deepEqual([...hawaii].sort(), [
    'giant-clam',
    'money-cowrie',
    'textile-cone',
    'tiger-cowrie',
  ])
  // Records outside the documented range come last.
  const last = shellsAt('bahamas', ids).at(-1)!
  assert.equal(last.speciesId, 'tiger-cowrie')
  assert.equal(last.outside, true)
  const tiger = getSpecies('tiger-cowrie')
  const local = localForm(tiger, 'hawaiian-islands')
  assert.equal(local.species.scientificName, 'Cypraea tigris schilderiana')
  assert.equal(local.species.lengthMm.max, 153)
  assert.ok(manifest.claims.some((claim) => claim.id === local.claim))
  assert.equal(localForm(tiger, 'red-sea').species, tiger)
})

test('every place with shells has water and sand matched to underwater photos', async () => {
  const { matchedColours } = await import('../src/sim/places.ts')
  const { placesWithShells } = await import('../src/sim/ranges.ts')
  for (const { region } of placesWithShells(allSpecies.map((s) => s.id))) {
    // No daylight reaches the abyss: there are no photos to match, and it is drawn dark.
    if (region.id === 'east-pacific-abyss') continue
    const matched = matchedColours[region.id]
    assert.ok(matched, `${region.id} has no photo-matched colours`)
    for (const c of [...matched.water, ...matched.sand])
      assert.ok(Number.isInteger(c) && c >= 0 && c <= 255)
    // Water is blue-green, never warmer than it is blue.
    assert.ok(matched.water[2] > matched.water[0], region.id)
    // The cast keeps blue or green strongest, and red absorbed most.
    assert.ok(Math.max(...matched.cast) === 1, region.id)
    assert.ok(matched.cast[0] <= Math.max(matched.cast[1]!, matched.cast[2]!))
    // Every photo can be traced to its page, author and licence.
    for (const photo of matched.photos as { page: string; license: string }[]) {
      assert.match(photo.page, /^https:\/\/commons\.wikimedia\.org\//)
      assert.ok(photo.license)
    }
  }
})
