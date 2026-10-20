import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import manifest from '../data/claims.json' with { type: 'json' }
import { glossary, speciesTerms } from '../src/sim/glossary.ts'

const claimIds = new Set(manifest.claims.map((claim) => claim.id))
const scene = readFileSync(
  new URL('../src/sim/scene.ts', import.meta.url),
  'utf8',
)

test('every part label the figure draws is explained by a sourced claim', () => {
  const named = [
    ...scene.matchAll(/marker\(\s*'([^']+)'/g),
    ...scene.matchAll(/markMesh\([^,]+,\s*'([^']+)'/g),
  ].map((match) => match[1]!)
  assert.ok(named.length >= 20, `only ${named.length} labels found`)
  for (const name of named)
    assert.ok(glossary[name], `"${name}" is drawn but has no glossary entry`)
  const terms = [
    ...Object.entries(glossary),
    ...Object.values(speciesTerms).flatMap((entries) =>
      Object.entries(entries),
    ),
  ]
  for (const [name, term] of terms) {
    assert.ok(claimIds.has(term.claim), `${name} cites missing ${term.claim}`)
    assert.ok(term.what.length < 60, `${name}: keep "what" to a short line`)
    // Real information on use: at least a full sentence, still short enough for a card.
    assert.ok(
      term.use.length > 70 && term.use.length < 240,
      `${name}: "use" should say what the part does in one or two sentences`,
    )
    assert.ok(glossary[name], `${name} must also have a general entry`)
  }
  // The cowrie's opening is named by maturity: both names must be explained.
  for (const name of ['Toothed aperture', 'Aperture'])
    assert.ok(scene.includes(`'${name}'`) && glossary[name])
})

test('the figure glossary claims carry HTTPS sources', () => {
  const sources = new Map(manifest.sources.map((source) => [source.id, source]))
  for (const id of [
    'term-gastropod-shell-parts',
    'term-veliger-velum',
    'term-nautilus-chambers',
  ]) {
    const claim = manifest.claims.find((item) => item.id === id)
    assert.ok(claim, `${id} is missing`)
    assert.ok(claim.sourceIds.length > 0)
    for (const source of claim.sourceIds)
      assert.match(sources.get(source)?.url ?? '', /^https:\/\//)
  }
})
