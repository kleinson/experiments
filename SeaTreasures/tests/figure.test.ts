import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import manifest from '../data/claims.json' with { type: 'json' }
import { glossary, speciesTerms } from '../src/sim/glossary.ts'

const claimIds = new Set(manifest.claims.map((claim) => claim.id))
const read = (file: string) =>
  readFileSync(new URL(`../src/sim/${file}`, import.meta.url), 'utf8')
const scene = read('scene.ts') + read('velum.ts') + read('classes.ts')
/** Sentences end in . ! or ? before a capital (or a quote) or the end. */
const sentences = (text: string) =>
  text.split(/(?<=[.!?])\s+(?=[A-Z“‘])/).filter(Boolean).length

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
    assert.ok(term.claims.length > 0, `${name} cites no claim`)
    for (const claim of term.claims)
      assert.ok(claimIds.has(claim), `${name} cites missing ${claim}`)
    assert.ok(term.what.length < 60, `${name}: keep "what" to a short line`)
    // A TL;DR: what it is, why and how, together in two or three sentences, short enough for a card.
    const count = sentences(term.tldr)
    assert.ok(
      count >= 2 && count <= 3,
      `${name}: the TL;DR has ${count} sentences, not two or three`,
    )
    assert.ok(
      term.tldr.length > 120 && term.tldr.length < 420,
      `${name}: the TL;DR is ${term.tldr.length} characters`,
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
