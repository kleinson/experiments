import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import manifest from '../data/claims.json' with { type: 'json' }
import data from '../data/species.json' with { type: 'json' }
import { termFor } from '../src/sim/glossary.ts'
import { pearls } from '../src/sim/pearls.ts'

const claimIds = new Set(manifest.claims.map((claim) => claim.id))

test('pearls belong to bivalves and every step rests on a sourced claim', () => {
  for (const [id, kind] of Object.entries(pearls)) {
    const found = data.species.find((s) => s.id === id)
    assert.equal(found?.group, 'bivalve', id)
    for (const claim of [...kind.facts, ...kind.steps.flatMap((s) => s.claims)])
      assert.ok(claimIds.has(claim), `${id}: missing claim ${claim}`)
    const sizes = kind.steps.map((step) => step.mm)
    assert.deepEqual(
      sizes,
      [...sizes].sort((a, b) => a - b),
      `${id}: steps grow`,
    )
  }
})

test('the giant clam record pearl is drawn at its measured size', () => {
  const record = pearls['giant-clam']!.steps.at(-1)!
  assert.equal(record.mm, 240)
  assert.ok(record.blister)
  const claim = manifest.claims.find((c) => c.id === 'giant-clam-pearl-lao-tzu')
  assert.match(claim!.text, /24 cm/)
})

test('every pearl label is explained for the giant clam', () => {
  const source = readFileSync(
    new URL('../src/sim/pearls.ts', import.meta.url),
    'utf8',
  )
  const labels = [
    ...source.matchAll(
      /userData\.label = (?:[^'\n]*\? )?'([^']+)'(?: : '([^']+)')?/g,
    ),
  ].flatMap((m) => [m[1], m[2]].filter(Boolean) as string[])
  assert.ok(labels.length >= 5, labels.join(', '))
  for (const label of labels) {
    const term = termFor(label, 'giant-clam')
    assert.ok(term, `no glossary entry for ${label}`)
    for (const claim of term.claims) assert.ok(claimIds.has(claim), claim)
  }
})
