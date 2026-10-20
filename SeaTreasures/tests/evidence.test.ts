import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import {
  getClaim,
  manifest,
  parseManifest,
  sourcesFor,
} from '../src/evidence.ts'

test('the offline evidence manifest has substantive claims and identifiable sources', () => {
  assert.ok(manifest.claims.length >= 10)
  assert.ok(manifest.sources.length >= 3)
  assert.deepEqual(
    parseManifest(JSON.parse(JSON.stringify(manifest))),
    manifest,
  )
  for (const claim of manifest.claims) {
    assert.ok(claim.text.trim().length > 15)
    assert.ok(claim.evidenceNote.trim().length > 15)
    if (claim.scope !== 'demo-limitation')
      assert.ok(sourcesFor(claim).length > 0)
    assert.ok(['high', 'moderate', 'limited'].includes(claim.confidence))
  }
})

test('every fact the simulator writes in its own words exists in the manifest', () => {
  const ui = readFileSync(
    new URL('../src/sim/Simulator.tsx', import.meta.url),
    'utf8',
  )
  const references = [...ui.matchAll(/<Fact claim="([^"]+)"/g)].map(
    (match) => match[1],
  )
  assert.ok(references.length >= 1)
  for (const id of references) assert.equal(getClaim(id).id, id)
  assert.throws(() => getClaim('a-nonexistent-claim'), /missing claim/)
})

test('claim references, scopes, access dates and external source links are explicit', () => {
  for (const source of manifest.sources) {
    assert.equal(new URL(source.url).protocol, 'https:')
    assert.match(source.accessedAt, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(source.publisher.trim())
    assert.ok(source.title.trim())
    assert.ok(source.kind.trim())
  }
  for (const claim of manifest.claims) {
    assert.ok(
      [
        'subspecies',
        'species',
        'family',
        'mollusks',
        'other-cowries',
        'demo-limitation',
        'place',
      ].includes(claim.scope),
    )
    assert.equal(new Set(claim.sourceIds).size, claim.sourceIds.length)
  }
})

test('repair is backed by direct experimental evidence, not inferred only from biomineralization', () => {
  const repair = getClaim('repair-shell-damage')
  assert.match(repair.text, /Mytilus californianus/)
  assert.match(repair.text, /not a cowrie repair timetable/)
  assert.equal(repair.scope, 'mollusks')
  assert.ok(
    sourcesFor(repair).some((source) => source.kind === 'peer-reviewed'),
  )
})

test('no missing, insecure, duplicated or source-free scientific entry can masquerade as evidence', () => {
  const firstSource = manifest.sources[0]
  const firstClaim = manifest.claims[0]
  const valid = {
    version: 1,
    sources: [firstSource],
    claims: [{ ...firstClaim, sourceIds: [firstSource.id] }],
  }
  for (const bad of [
    null,
    {},
    { ...valid, version: 2 },
    { version: 1, sources: [], claims: [] },
    { ...valid, sources: [firstSource, firstSource] },
    {
      ...valid,
      sources: [{ ...firstSource, url: 'http://example.org/source' }],
    },
    { ...valid, sources: [{ ...firstSource, accessedAt: 'not a date' }] },
    { ...valid, claims: [valid.claims[0], valid.claims[0]] },
    { ...valid, claims: [{ ...firstClaim, sourceIds: ['missing'] }] },
    { ...valid, claims: [{ ...firstClaim, scope: 'species', sourceIds: [] }] },
    { ...valid, claims: [{ ...firstClaim, confidence: 'certain' }] },
  ]) {
    assert.throws(() => parseManifest(bad))
  }
})

test('gallery registration leads to real local entry and original artwork', (t) => {
  const registryFile = new URL('../../experiments.json', import.meta.url)
  if (!existsSync(registryFile)) {
    t.skip('Only runs inside the kleinson/experiments collection.')
    return
  }
  const registry: unknown = JSON.parse(readFileSync(registryFile, 'utf8'))
  assert.ok(Array.isArray(registry))
  const entry = registry.find((item) => item.id === 'seatreasures')
  assert.ok(entry)
  assert.equal(entry.path, 'SeaTreasures/')
  assert.ok(existsSync(new URL('../index.html', import.meta.url)))
  assert.equal(entry.preview, 'SeaTreasures/public/shell-mark.svg')
  assert.ok(existsSync(new URL('../public/shell-mark.svg', import.meta.url)))
})

test('web app icons are local, correctly sized PNGs with no remote artwork dependency', () => {
  for (const size of [180, 192, 512]) {
    const png = readFileSync(
      new URL(`../public/shell-icon-${size}.png`, import.meta.url),
    )
    assert.equal(png.subarray(1, 4).toString(), 'PNG')
    assert.equal(png.readUInt32BE(16), size)
    assert.equal(png.readUInt32BE(20), size)
  }
})
