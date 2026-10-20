/**
 * Builds data/species.json and adds research claims and sources to
 * data/claims.json from the fragments in data/research/. Run it after editing
 * a fragment: `npm run species`, then `npm run sync:ios`.
 *
 * It only appends: claims already in claims.json are kept, never overwritten.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const root = new URL('../data/', import.meta.url).pathname
const fragments = [
  'research/gastropods.json',
  'research/conch-nautilus.json',
  'research/essentials.json',
  'research/figure-terms.json',
  'research/places.json',
  'research/part-functions.json',
]
  .filter((file) => existsSync(root + file))
  .map((file) => ({
    file,
    data: JSON.parse(readFileSync(root + file, 'utf8')),
  }))
console.log(`Merging ${fragments.map((f) => f.file).join(', ')}`)

const manifest = JSON.parse(readFileSync(root + 'claims.json', 'utf8'))
const sourceIds = new Map(manifest.sources.map((s) => [s.id, s]))
const claimIds = new Map(manifest.claims.map((c) => [c.id, c]))
for (const { file, data } of fragments) {
  for (const source of data.sources) {
    const existing = sourceIds.get(source.id)
    if (existing && existing.url !== source.url)
      throw new Error(`${file}: source id clash ${source.id}`)
    if (!existing) {
      manifest.sources.push(source)
      sourceIds.set(source.id, source)
    }
  }
  for (const claim of data.claims) {
    if (claimIds.has(claim.id)) {
      console.log(`${file}: keeping the first copy of ${claim.id}`)
      continue
    }
    for (const id of claim.sourceIds)
      if (!sourceIds.has(id))
        throw new Error(`${file}: ${claim.id} cites missing ${id}`)
    manifest.claims.push(claim)
    claimIds.set(claim.id, claim)
  }
}

const unsourcedDeath = 'death-cause-not-documented'
if (!claimIds.has(unsourcedDeath)) {
  const claim = {
    id: unsourcedDeath,
    text: 'The sources used for this simulator do not document how this species usually dies, so this ending names no predator.',
    sourceIds: [],
    scope: 'demo-limitation',
    confidence: 'high',
    evidenceNote:
      'A deliberate gap: predators reported only in unverified summaries were left out rather than presented as fact.',
  }
  manifest.claims.push(claim)
  claimIds.set(claim.id, claim)
}

const names = {
  'tiger-cowrie': 'Tiger cowrie',
  'money-cowrie': 'Money cowrie',
  'textile-cone': 'Textile cone',
  'queen-conch': 'Queen conch',
  'chambered-nautilus': 'Chambered nautilus',
}
const order = Object.keys(names)
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
/** Short, plain labels for death choices; the sourced wording stays in the evidence. */
const labelOf = (cause, claim) =>
  /shell-damage-observed/.test(claim)
    ? 'A hole, possibly from an octopus (one photographed shell)'
    : cause
const markOf = (cause) =>
  /octop|drill|moon snail|naticid|bore/i.test(cause)
    ? 'drill'
    : /crab|fish|ray|turtle|crush|lobster|bite/i.test(cause)
      ? 'chip'
      : 'none'
const duration = (stage, unit) => ({
  text: stage?.text ?? 'Not established in the sources used here.',
  range: (unit === 'days' ? stage?.durationDays : stage?.durationYears) ?? null,
  unit,
  claim: stage?.claim ?? null,
})

const merged = {}
let shared = { remains: [], collecting: [] }
for (const { data } of fragments) {
  Object.assign(merged, data.species)
  if (data.shared) shared = data.shared
}
if (
  claimIds.has('hermit-crab-shell-reuse') &&
  !shared.remains.some((r) => r.claim === 'hermit-crab-shell-reuse')
)
  shared.remains.unshift({
    id: 'hermit-crab-reuse',
    text: 'Hermit crabs move into empty snail shells and use them as portable homes.',
    claim: 'hermit-crab-shell-reuse',
  })
const species = order
  .filter((id) => merged[id])
  .map((id) => {
    const s = merged[id]
    const typical = s.lengthMm?.typical ?? null
    // Without a typical range, draw a smaller, ordinary specimen below the reported maximum.
    const drawn = typical
      ? Math.round((typical[0] + typical[1]) / 2)
      : s.lengthMm?.max
        ? Math.round(
            s.lengthMm.max * (id === 'chambered-nautilus' ? 0.65 : 0.8),
          )
        : null
    if (!drawn) throw new Error(`${id} has no sourced size to draw`)
    const group = id === 'chambered-nautilus' ? 'cephalopod' : 'gastropod'
    return {
      id,
      commonName: names[id],
      scientificName: s.scientificName,
      authority: s.authority,
      aphiaId: s.aphiaId,
      taxonClaim: s.taxonClaim,
      group,
      lengthMm: {
        typical,
        max: s.lengthMm?.max ?? null,
        drawn,
        claim: s.lengthMm.claim,
      },
      origins: s.origins.map((o) => ({
        id: o.id,
        name: o.name,
        habitat: o.habitat,
        depthM: o.depthM ?? null,
        claim: o.claim,
      })),
      pattern: s.pattern,
      life: {
        egg: duration(s.life?.egg, 'days'),
        larva: duration(s.life?.larva, 'days'),
        maturity: duration(s.life?.maturity, 'years'),
        lifespan: duration(s.life?.lifespan, 'years'),
      },
      deaths: [
        ...(s.deaths ?? []).map((d) => ({
          id: slug(labelOf(d.cause, d.claim)),
          cause: labelOf(d.cause, d.claim),
          mark: markOf(d.cause),
          claim: d.claim,
        })),
        {
          id: 'not-documented',
          cause: 'Cause not documented in our sources',
          mark: 'none',
          claim: unsourcedDeath,
        },
      ],
      remains: (s.remains ?? []).map((r) => ({
        id: r.id ?? r.claim,
        text: r.text,
        claim: r.claim,
      })),
      collecting: (s.collecting ?? []).map((c) => ({
        id: c.id ?? c.claim,
        text: c.text,
        claim: c.claim,
      })),
      hermit:
        group === 'gastropod' &&
        shared.remains.some((r) => /hermit/i.test(r.id + r.text)),
      drifts:
        group === 'cephalopod' &&
        (s.remains ?? []).some((r) => /drift|float/i.test(r.text)),
      drawnNote: typical
        ? 'Drawn at the middle of the typical range.'
        : 'Drawn at an ordinary size below the reported maximum; no typical range was found.',
    }
  })
const allClaims = (sp) => [
  sp.taxonClaim,
  sp.lengthMm.claim,
  sp.pattern.claim,
  ...sp.origins.map((o) => o.claim),
  ...Object.values(sp.life)
    .map((l) => l.claim)
    .filter(Boolean),
  ...sp.deaths.map((d) => d.claim),
  ...sp.remains.map((r) => r.claim),
  ...sp.collecting.map((c) => c.claim),
]
for (const sp of species)
  for (const id of allClaims(sp))
    if (!claimIds.has(id)) throw new Error(`${sp.id} uses missing claim ${id}`)
for (const item of [...shared.remains, ...shared.collecting])
  if (!claimIds.has(item.claim))
    throw new Error(`shared uses missing claim ${item.claim}`)

writeFileSync(root + 'claims.json', JSON.stringify(manifest, null, 2) + '\n')
writeFileSync(
  root + 'species.json',
  JSON.stringify({ species, shared }, null, 2) + '\n',
)
console.log(
  `Merged: ${manifest.sources.length} sources, ${manifest.claims.length} claims, species ${species.map((s) => s.id).join(', ')}`,
)
for (const sp of species) {
  const l = sp.life
  console.log(
    sp.id,
    '| drawn',
    sp.lengthMm.drawn,
    'mm | egg',
    l.egg.range,
    '| larva',
    l.larva.range,
    '| maturity',
    l.maturity.range,
    '| lifespan',
    l.lifespan.range,
    '| deaths',
    sp.deaths.map((d) => d.mark).join(','),
    '| origins',
    sp.origins.length,
  )
}
