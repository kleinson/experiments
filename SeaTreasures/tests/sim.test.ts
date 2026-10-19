import test from 'node:test'
import assert from 'node:assert/strict'
import {
  adultAngle,
  builtAngle,
  coilBounds,
  coilPoint,
  coilScale,
  growthRate,
  septumAngles,
} from '../src/sim/coil.ts'
import type { Coil } from '../src/sim/coil.ts'
import { shapes } from '../src/sim/shapes.ts'
import { looks } from '../src/sim/looks.ts'
import { patternPixels, weather } from '../src/sim/patterns.ts'
import {
  clockAt,
  describeDuration,
  frameAt,
  phaseAt,
  phases,
  startOf,
} from '../src/sim/life.ts'
import type { Species } from '../src/sim/species.ts'
import {
  CARD_MM,
  DEFAULT_PX_PER_MM,
  parseCalibration,
  readCalibration,
  saveCalibration,
  scaleBar,
} from '../src/sim/calibration.ts'
import { addToShelf, parseShelf, SHELF_LIMIT } from '../src/sim/shelf.ts'

const coils = Object.entries(shapes).flatMap(([id, shape]) =>
  shape.kind === 'coil' ? [[id, shape.coil] as [string, Coil]] : [],
)

test('every coiled shell is finite, sized to its adult length, and grows only at the aperture', () => {
  for (const [id, coil] of coils) {
    const scale = coilScale(coil, 100)
    const { min, max } = coilBounds(coil)
    const extent =
      Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * scale
    assert.ok(Math.abs(extent - 100) < 1e-6, `${id} adult length is exact`)
    for (let theta = 0.05; theta < adultAngle(coil); theta += 0.37) {
      for (const s of [0, 1.3, 3.1, 4.4]) {
        assert.ok(
          coilPoint(coil, theta, s).every(Number.isFinite),
          `${id} point is finite`,
        )
        assert.ok(
          coilPoint(coil, theta, s, { inset: 0.5, flare: 1 }).every(
            Number.isFinite,
          ),
        )
      }
    }
    let previous = 0
    for (const fraction of [0.01, 0.05, 0.2, 0.5, 0.9, 1]) {
      const angle = builtAngle(coil, fraction)
      assert.ok(angle >= previous, `${id} never un-builds shell`)
      assert.ok(angle <= adultAngle(coil) + 1e-9)
      previous = angle
    }
    assert.equal(builtAngle(coil, 1), adultAngle(coil))
    const half = builtAngle(coil, 0.5)
    const size = (theta: number) => Math.exp(growthRate(coil) * theta)
    assert.ok(
      Math.abs(size(half) / size(adultAngle(coil)) - 0.5) < 1e-9 ||
        half === Math.PI * 1.2,
    )
  }
})

test('chambered shells place their walls behind the living chamber', () => {
  const shape = shapes['chambered-nautilus']!
  assert.equal(shape.kind, 'coil')
  if (shape.kind !== 'coil' || !shape.chambers) return
  const end = adultAngle(shape.coil)
  const walls = septumAngles(
    end,
    shape.chambers.perTurn,
    shape.chambers.bodyChamber,
  )
  assert.ok(walls.length > 10)
  assert.ok(walls.every((theta) => theta < end - shape.chambers!.bodyChamber))
  assert.ok(
    walls.every((theta, index) => index === 0 || theta > walls[index - 1]!),
  )
})

test('patterns are deterministic, in range, and weathering only fades them', () => {
  for (const [id, look] of Object.entries(looks)) {
    const a = patternPixels(look.pattern, look.seed, 96, 48)
    const b = patternPixels(look.pattern, look.seed, 96, 48)
    assert.deepEqual(a.data, b.data, `${id} is the same shell every time`)
    assert.equal(a.data.length, 96 * 48 * 4)
    const worn = weather(a, 0.6)
    let spread = 0
    let wornSpread = 0
    for (let at = 0; at < a.data.length; at += 4) {
      spread +=
        Math.max(a.data[at]!, a.data[at + 1]!, a.data[at + 2]!) -
        Math.min(a.data[at]!, a.data[at + 1]!, a.data[at + 2]!)
      wornSpread +=
        Math.max(worn.data[at]!, worn.data[at + 1]!, worn.data[at + 2]!) -
        Math.min(worn.data[at]!, worn.data[at + 1]!, worn.data[at + 2]!)
    }
    assert.ok(wornSpread <= spread, `${id} weathering removes colour`)
  }
})

test('the textile cone pattern contains many separate tents, not a single block', () => {
  const look = looks['textile-cone']!
  const pixels = patternPixels(look.pattern, look.seed, 240, 240)
  if (look.pattern.kind !== 'tents') throw new Error('Expected a tent pattern')
  const light = look.pattern.light
  let lit = 0
  for (let at = 0; at < pixels.data.length; at += 4) {
    if (
      Math.abs(pixels.data[at]! - light[0]) < 12 &&
      Math.abs(pixels.data[at + 1]! - light[1]) < 12
    )
      lit++
  }
  const share = lit / (pixels.data.length / 4)
  assert.ok(share > 0.08 && share < 0.75, `light tents cover ${share}`)
})

const fake: Species = {
  id: 'test',
  commonName: 'Test shell',
  scientificName: 'Testus testus',
  authority: 'Tester, 2026',
  aphiaId: 1,
  taxonClaim: 'x',
  group: 'gastropod',
  lengthMm: { typical: [10, 20], max: 25, drawn: 18, claim: 'x' },
  origins: [
    { id: 'o', name: 'Somewhere', habitat: 'Reef', depthM: [0, 5], claim: 'x' },
  ],
  pattern: { description: 'Spots', claim: 'x' },
  life: {
    egg: { text: 'Eggs', range: [10, 20], unit: 'days', claim: 'x' },
    larva: { text: 'Larva', range: null, unit: 'days', claim: null },
    maturity: { text: 'Adult', range: [2, 3], unit: 'years', claim: 'x' },
    lifespan: { text: 'Lives', range: null, unit: 'years', claim: null },
  },
  deaths: [{ id: 'd', cause: 'Octopus', mark: 'drill', claim: 'x' }],
  remains: [],
  collecting: [],
  hermit: true,
  drifts: false,
  drawnNote: 'Test size.',
}

test('the timeline covers a whole life in order and ends in a hand', () => {
  assert.deepEqual(
    phases.map((phase) => phase.id),
    ['egg', 'larva', 'growth', 'adult', 'death', 'remains', 'beach', 'found'],
  )
  assert.ok(
    Math.abs(phases.reduce((sum, phase) => sum + phase.share, 0) - 1) < 1e-9,
  )
  assert.equal(phaseAt(0).phase.id, 'egg')
  assert.equal(phaseAt(1).phase.id, 'found')
  for (const phase of phases)
    assert.equal(phaseAt(startOf(phase.id) + 0.0001).phase.id, phase.id)
  let size = -1
  for (let t = 0; t <= startOf('adult'); t += 0.01) {
    const frame = frameAt(t, fake, 'drill')
    assert.ok(frame.size >= size, 'the shell never shrinks while alive')
    size = frame.size
  }
  assert.equal(frameAt(startOf('egg') + 0.01, fake, 'drill').size, 0)
  assert.equal(frameAt(startOf('remains') + 0.01, fake, 'drill').animal, 0)
  assert.equal(frameAt(startOf('remains') + 0.01, fake, 'drill').mark, 'drill')
  assert.ok(frameAt(startOf('remains') + 0.1, fake, 'drill').hermit > 0)
  assert.equal(
    frameAt(startOf('remains') + 0.1, { ...fake, hermit: false }, 'drill')
      .hermit,
    0,
  )
  assert.ok(
    frameAt(0.999, fake, 'none').wear >
      frameAt(startOf('beach'), fake, 'none').wear,
  )
})

test('the clock only states sourced durations and says so when one is unknown', () => {
  assert.equal(describeDuration(fake.life.egg), '10–20 days')
  assert.equal(describeDuration(fake.life.larva), 'Not established')
  assert.equal(
    describeDuration({ ...fake.life.maturity, range: [1, 1] }),
    'About 1 year',
  )
  const growing = clockAt(frameAt(startOf('growth') + 0.05, fake, 'none'), fake)
  assert.equal(growing.known, true)
  assert.match(growing.label, /2–3 years/)
  const adult = clockAt(frameAt(startOf('adult') + 0.05, fake, 'none'), fake)
  assert.equal(adult.known, false)
  assert.match(adult.label, /not established/)
})

test('actual size uses a remembered card calibration and rejects impossible values', () => {
  assert.ok(Math.abs(DEFAULT_PX_PER_MM - 3.7795) < 1e-3)
  assert.deepEqual(CARD_MM, [85.6, 53.98])
  assert.equal(parseCalibration(null), null)
  assert.equal(parseCalibration(JSON.stringify({ pxPerMm: 5 })), 5)
  assert.throws(() => parseCalibration(JSON.stringify({ pxPerMm: 50 })))
  assert.throws(() => parseCalibration('{broken'))
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  }
  assert.deepEqual(readCalibration(storage), {
    pxPerMm: DEFAULT_PX_PER_MM,
    calibrated: false,
    error: null,
  })
  saveCalibration(storage, 4.4)
  assert.equal(readCalibration(storage).pxPerMm, 4.4)
  assert.equal(readCalibration(storage).calibrated, true)
  assert.throws(() => saveCalibration(storage, Number.NaN))
  store.set('seatreasures.calibration.v1', '{damaged')
  assert.equal(readCalibration(storage).error !== null, true)
  for (const px of [2, 3.78, 6, 9]) {
    const bar = scaleBar(px)
    assert.ok(Math.abs(bar.px - bar.mm * px) < 1e-9)
    assert.ok(bar.px > 20 && bar.px < 140)
  }
})

test('the shelf keeps found shells strictly and never accepts unknown or broken records', () => {
  const known = (species: string, origin: string) =>
    species === 'tiger-cowrie' && origin === 'hawaii'
  assert.deepEqual(parseShelf(null, known), [])
  const shelf = addToShelf(
    [],
    { speciesId: 'tiger-cowrie', originId: 'hawaii' },
    new Date('2026-10-19T12:00:00Z'),
  )
  assert.deepEqual(parseShelf(JSON.stringify(shelf), known), shelf)
  assert.throws(() => parseShelf('{"x":1}', known))
  assert.throws(() =>
    parseShelf(
      JSON.stringify([
        { speciesId: 'dragon', originId: 'hawaii', foundAt: shelf[0]!.foundAt },
      ]),
      known,
    ),
  )
  assert.throws(() =>
    parseShelf(JSON.stringify([{ ...shelf[0], foundAt: 'yesterday' }]), known),
  )
  let full: typeof shelf = []
  for (let i = 0; i < SHELF_LIMIT + 5; i++)
    full = addToShelf(full, { speciesId: 'tiger-cowrie', originId: 'hawaii' })
  assert.equal(full.length, SHELF_LIMIT)
})
