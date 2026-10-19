import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bounded,
  collectionKey,
  createSavedSpecimen,
  describeSize,
  experience,
  getShape,
  getShellSummary,
  getStage,
  initialShellState,
  moments,
  parseSavedSpecimen,
} from '../src/model.ts'

test('the experience has five distinct moments and one clearly identified demo', () => {
  assert.equal(moments.length, 5)
  assert.equal(new Set(moments.map((moment) => moment.id)).size, 5)
  assert.equal(
    experience.specimen.scientificName,
    'Cypraea tigris schilderiana',
  )
  assert.match(experience.specimen.identificationNotice, /demo.*not a photo/i)
  assert.match(experience.specimen.artworkNotice, /conceptual.*not an age/i)
  assert.equal(initialShellState.lengthMm, experience.specimen.defaultLengthMm)
})

test('growth stages use exact conceptual boundaries, including endpoints', () => {
  for (const [progress, expected] of [
    [-10, 'juvenile'],
    [0, 'juvenile'],
    [24, 'juvenile'],
    [25, 'developing'],
    [49, 'developing'],
    [50, 'subadult'],
    [74, 'subadult'],
    [75, 'mature'],
    [100, 'mature'],
    [200, 'mature'],
  ] as const) {
    assert.equal(getStage(progress).id, expected)
  }
})

test('nonfinite growth and bounds values cannot become silent defaults', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => bounded(value, 0, 100), RangeError)
    assert.throws(() => getStage(value), RangeError)
    assert.throws(() => getShape(value), RangeError)
  }
})

test('one coherent model enlarges the shell and narrows its opening', () => {
  let previous = getShape(0)
  for (let progress = 1; progress <= 100; progress++) {
    const shape = getShape(progress)
    assert.ok(shape.scale > previous.scale)
    assert.ok(shape.opening < previous.opening)
    assert.ok(shape.teeth >= previous.teeth)
    assert.ok(shape.coilVisibility <= previous.coilVisibility)
    assert.ok(shape.opening > 0)
    previous = shape
  }
  assert.equal(getShape(0).teeth, 0)
  assert.equal(getShape(100).coilVisibility, 0)
  assert.equal(getShape(100).teeth, 1)
})

test('stage and size never produce a chronological age or lifespan estimate', () => {
  for (const lengthMm of [50, 90, 110, 120, 150, 160]) {
    for (const progress of [0, 25, 50, 75, 100]) {
      const summary = getShellSummary({
        ...initialShellState,
        lengthMm,
        progress,
      })
      assert.match(summary, /age is unknown/i)
      assert.match(
        summary,
        new RegExp(`reference length ${lengthMm} millimeters`),
      )
      assert.match(summary, /independent of the growth-stage slider/i)
      assert.doesNotMatch(summary, /\d+\s*(years?|months?|days?)\s*old/i)
    }
  }
})

test('illustrative size comparisons explicitly avoid population statistics', () => {
  assert.deepEqual(experience.measurement.comparisonLengthsMm, [90, 120, 150])
  assert.match(
    experience.measurement.comparisonNotice,
    /chosen comparison lengths/i,
  )
  assert.match(
    experience.measurement.comparisonNotice,
    /not population percentiles or age/i,
  )
})

test('size reference uses exact sourced marker boundaries without inventing age or percentiles', () => {
  for (const [length, category] of [
    [50, 'reference'],
    [100, 'reference'],
    [125, 'reference'],
    [126, 'large'],
    [149, 'large'],
    [150, 'near-maximum'],
    [153, 'near-maximum'],
    [154, 'beyond-reference'],
    [160, 'beyond-reference'],
  ] as const) {
    const description = describeSize(length)
    assert.equal(description.category, category)
    assert.doesNotMatch(description.detail, /\d+\s*(years?|months?) old/i)
    assert.doesNotMatch(description.detail, /\d+%/)
  }
  assert.match(describeSize(110).detail, /10 mm longer/)
  assert.match(describeSize(150).detail, /3 mm below/)
  assert.match(describeSize(160).detail, /not a record claim/)
  assert.throws(() => describeSize(NaN))
  assert.equal(experience.sizeGuide.claimId, 'size-reference-schilderiana')
})

test('local collection round-trips length, note, specimen and actual save timestamp', () => {
  const now = new Date('2026-10-19T09:12:00.000Z')
  const saved = createSavedSpecimen(
    120,
    'The animal is the interesting part.',
    now,
  )
  assert.equal(saved.savedAt, now.toISOString())
  assert.equal(saved.specimenId, experience.specimen.id)
  assert.equal(saved.lengthMm, 120)
  assert.deepEqual(parseSavedSpecimen(JSON.stringify(saved)), saved)
  assert.equal(collectionKey, 'seatreasures.collection.v1')
  assert.equal('age' in saved, false)
  assert.equal('collectedAt' in saved, false)
})

test('collection rejects malformed, foreign, unsupported and impossible records', () => {
  const valid = createSavedSpecimen(110, '')
  for (const value of [
    null,
    [],
    {},
    { ...valid, version: 2 },
    { ...valid, specimenId: 'different-shell' },
    { ...valid, lengthMm: 49 },
    { ...valid, lengthMm: 161 },
    { ...valid, lengthMm: 110.5 },
    { ...valid, lengthMm: '110' },
    { ...valid, savedAt: 'not a date' },
    { ...valid, note: 'x'.repeat(281) },
    { ...valid, note: null },
  ]) {
    assert.throws(() => parseSavedSpecimen(JSON.stringify(value)))
  }
  assert.throws(() => parseSavedSpecimen('{'))
})

test('collection validates exact length and note limits before writing', () => {
  for (const length of [50, 160]) {
    assert.equal(createSavedSpecimen(length, 'x'.repeat(280)).lengthMm, length)
  }
  for (const length of [49, 161, 1.5, NaN, Infinity]) {
    assert.throws(() => createSavedSpecimen(length, ''), RangeError)
  }
  assert.throws(() => createSavedSpecimen(110, 'x'.repeat(281)), RangeError)
})
