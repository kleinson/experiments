import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import manifest from '../data/claims.json' with { type: 'json' }
import {
  anatomyParts,
  cutawayProjection,
  cutawaySvg,
  partAnchors,
} from '../src/anatomy/animal.ts'
import {
  drawerProjection,
  drawerSvg,
  drawerTargets,
  stageProgress,
} from '../src/anatomy/drawer.ts'
import { partNotes, tourOrder } from '../src/anatomy/parts.ts'
import { wallProjection, wallSvg } from '../src/anatomy/wall.ts'
import { beyond, ellipsoid, surfaceItems } from '../src/anatomy/surface.ts'

const numbers = (svg: string) =>
  [...svg.matchAll(/-?\d+(?:\.\d+)?(?:e-?\d+)?|NaN|Infinity/g)].map((m) =>
    Number(m[0]),
  )

function assertDrawable(svg: string, label: string) {
  assert.ok(svg.length > 1000, `${label} draws something`)
  assert.ok(!/NaN|Infinity|undefined/.test(svg), `${label} has no bad numbers`)
  assert.ok(
    numbers(svg).every(Number.isFinite),
    `${label} coordinates are finite`,
  )
  assert.ok(
    !/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(svg),
    `${label} paints only through theme classes, never literal colours`,
  )
}

test('the specimen drawer shows every conceptual stage from the shared model', () => {
  assert.deepEqual(stageProgress, [0, 25, 50, 100])
  const P = drawerProjection()
  const svg = drawerSvg(110, P)
  assertDrawable(svg, 'drawer')
  for (let stage = 0; stage < 4; stage++)
    assert.ok(
      svg.includes(`data-part="stage-${stage}"`),
      `stage ${stage} drawn`,
    )
  assert.equal(drawerTargets(P).length, 4)
  assert.notEqual(
    svg,
    drawerSvg(150, P),
    'the adult reference length changes the drawing',
  )
  assert.equal(svg, drawerSvg(110, P), 'drawing is deterministic')
})

test('the cutaway reveals the inside only when opened, with a true section face', () => {
  const P = cutawayProjection()
  const closed = cutawaySvg(0, 55, P)
  const open = cutawaySvg(1, 55, P)
  assertDrawable(closed, 'closed cutaway')
  assertDrawable(open, 'open cutaway')
  assert.ok(
    !closed.includes('class="an-cut"'),
    'a closed shell has no cut face',
  )
  assert.ok(
    open.includes('class="an-cut"'),
    'an opened shell shows its wall in section',
  )
  for (const part of [
    'gill',
    'heart',
    'kidney',
    'digestive',
    'gonad',
    'radula',
  ])
    assert.ok(open.includes(`data-part="${part}"`), `${part} drawn when open`)
  assert.ok(
    !closed.includes('data-part="gill"'),
    'organs are not drawn while hidden',
  )
  assert.ok(
    !cutawaySvg(1, 0, P).includes('data-part="mantle"'),
    'no mantle is drawn at zero coverage',
  )
  assert.ok(partAnchors(1, P).length > partAnchors(0, P).length)
})

test('plane clipping keeps only the near side of the section', () => {
  const clip = {
    normal: [0, 1, 0] as [number, number, number],
    origin: [0, 0, 0] as [number, number, number],
    offset: 0,
  }
  const blob = ellipsoid([0, 0, 0], [10, 10, 10])
  const P = cutawayProjection()
  const items = surfaceItems(blob, P, {
    rows: 12,
    columns: 16,
    wrap: true,
    center: [0, 0, 0],
    clip,
  })
  assert.ok(items.length > 0)
  assert.ok(beyond(clip, [0, 5, 0]) > 0 && beyond(clip, [0, -5, 0]) < 0)
})

test('every highlighted part is explained by a claim in the source manifest', () => {
  const ids = new Set(manifest.claims.map((claim) => claim.id))
  for (const part of anatomyParts) {
    const note = partNotes[part]
    assert.ok(note, `${part} has a note`)
    assert.ok(ids.has(note.claim), `${part} cites ${note.claim}`)
  }
  assert.deepEqual(
    new Set(tourOrder),
    new Set(anatomyParts.filter((p) => p !== 'visceral')),
  )
  const wall = readFileSync(
    new URL('../src/anatomy/WallFigure.tsx', import.meta.url),
    'utf8',
  )
  assert.match(wall, /1–5%/, 'composition uses the sourced organic range')
  assert.ok(
    ids.has('shell-composition-caco3') && ids.has('shell-organic-matrix'),
  )
})

test('the shell wall grows its newest coat without moving the mantle above it', () => {
  const P = wallProjection()
  const start = wallSvg(0, P)
  const half = wallSvg(0.5, P)
  const done = wallSvg(1, P)
  for (const [svg, label] of [
    [start, 'empty'],
    [half, 'half'],
    [done, 'complete'],
  ] as const)
    assertDrawable(svg, `wall ${label}`)
  assert.notEqual(start, half)
  assert.notEqual(half, done)
  assert.ok(
    done.includes('class="an-spot"'),
    'the finished coat carries pattern',
  )
  assert.ok(
    !start.includes('class="an-spot"'),
    'no pattern before the coat exists',
  )
  const mantle = (svg: string) => svg.slice(svg.indexOf('data-lit'))
  assert.ok(mantle(start).length > 1000, 'the mantle cells are drawn')
  assert.equal(
    mantle(start),
    mantle(done),
    'the builder stays put while the coat grows',
  )
})

test('the vendored Anatomy kit keeps its MIT licence', () => {
  const licence = readFileSync(
    new URL('../src/anatomy/kit/LICENSE', import.meta.url),
    'utf8',
  )
  assert.match(licence, /MIT License/)
})
