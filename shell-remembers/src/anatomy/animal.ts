import { getShape } from '../model.ts'
import { shellPoint } from '../shellform.ts'
import * as k from './kit/iso-kit.ts'
import type { Plan, Point3, Projection } from './kit/iso-kit.ts'
import { cowrieCenter, cowrieItems } from './cowrie.ts'
import {
  bend,
  ellipsoid,
  markItem,
  paint,
  placeShell,
  surfaceItems,
  tubeAlong,
} from './surface.ts'
import { beyond, layer } from './surface.ts'
import type { Clip, Item, Param, SurfaceStyle } from './surface.ts'

export const CUTAWAY = { width: 680, height: 470 }

export const anatomyParts = [
  'shell',
  'mantle',
  'foot',
  'visceral',
  'head',
  'siphon',
  'gill',
  'osphradium',
  'heart',
  'kidney',
  'stomach',
  'digestive',
  'gonad',
  'gut',
  'radula',
] as const
export type AnatomyPart = (typeof anatomyParts)[number]

const SIZE = 55 / 1.78
const CENTER: Point3 = [0, 0, 30]
const place = placeShell(CENTER, SIZE)
const at = (x: number, y: number, z: number): Point3 => [
  CENTER[0] + x,
  CENTER[1] + y,
  CENTER[2] + z,
]

const SLAB: Plan = { x: -110, y: -50, w: 196, d: 100, r: 6 }
const SLAB_H = 14
const FOOT_H = 5
/** The section plane leans toward the viewer, removing the near upper quarter. */
const LEAN = (52 * Math.PI) / 180
const NORMAL: Point3 = [0, Math.cos(LEAN), Math.sin(LEAN)]
const reach = (point: Point3) =>
  (point[1] - CENTER[1]) * NORMAL[1] + (point[2] - CENTER[2]) * NORMAL[2]

export function cutawayProjection(): Projection {
  return k.fitProjection(
    [...k.boxCorners(SLAB, -SLAB_H - FOOT_H, 0), at(0, 0, 32), at(-90, 0, 12)],
    CUTAWAY.width,
    CUTAWAY.height,
    { pad: 12, azimuth: 112, elevation: 30 },
  )
}

/** How far the section plane sits from the shell centre: 42 is clear of it, 7 is deep. */
export const cutPlane = (open: number) => 42 - 35 * open
export const cutClip = (open: number): Clip | undefined =>
  open > 0.001
    ? { normal: NORMAL, origin: CENTER, offset: cutPlane(open) }
    : undefined

function crossings(
  surface: (theta: number) => Point3,
  limit: number,
  Y: number,
): number[] {
  const samples = 120
  const g = (theta: number) => reach(surface(theta)) - Y
  const found: number[] = []
  let previous = -limit
  let before = g(previous)
  for (let step = 1; step <= samples; step++) {
    const theta = -limit + (2 * limit * step) / samples
    const value = g(theta)
    if (before <= 0 !== value <= 0) {
      let low = previous
      let high = theta
      for (let i = 0; i < 24; i++) {
        const middle = (low + high) / 2
        if (g(low) <= 0 === g(middle) <= 0) low = middle
        else high = middle
      }
      found.push((low + high) / 2)
    }
    previous = theta
    before = value
  }
  return found
}

/** The cut face of the shell wall where the section plane passes through it. */
function sectionItems(Y: number, P: Projection): Item[] {
  const progress = 100
  const shape = getShape(progress)
  const limit = Math.PI - shape.opening
  const toWorld = (p: { x: number; y: number; z: number }) =>
    place([p.x, p.y, p.z])
  const rows = 72
  const pairs: (Point3[] | null)[][] = [[], []]
  for (let row = 0; row <= rows; row++) {
    const u = 0.003 + (row / rows) * 0.994
    const outer = (theta: number) => toWorld(shellPoint(u, theta, progress))
    const inner = (theta: number) =>
      toWorld(shellPoint(u, theta, progress, 0.035))
    const out = crossings(outer, limit, Y)
    const inside = crossings(inner, limit, Y)
    if (out.length < 2) {
      pairs[0]!.push(null)
      pairs[1]!.push(null)
      continue
    }
    const ends = [out[0]!, out[out.length - 1]!]
    const outerPoints = ends.map(outer)
    let innerPoints: Point3[]
    if (inside.length >= 2) {
      innerPoints = [inside[0]!, inside[inside.length - 1]!].map(inner)
    } else {
      const middle: Point3 = [
        (outerPoints[0]![0] + outerPoints[1]![0]) / 2,
        (outerPoints[0]![1] + outerPoints[1]![1]) / 2,
        (outerPoints[0]![2] + outerPoints[1]![2]) / 2,
      ]
      innerPoints = [middle, middle]
    }
    pairs[0]!.push([outerPoints[0]!, innerPoints[0]!])
    pairs[1]!.push([outerPoints[1]!, innerPoints[1]!])
  }
  const items: Item[] = []
  const path = (points: Point3[], closed = false) =>
    points
      .map((point, index) => {
        const [x, y] = k.iso(point, P)
        return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join('') + (closed ? 'Z' : '')
  const lerp = (pair: Point3[], f: number): Point3 => [
    pair[0]![0] + (pair[1]![0] - pair[0]![0]) * f,
    pair[0]![1] + (pair[1]![1] - pair[0]![1]) * f,
    pair[0]![2] + (pair[1]![2] - pair[0]![2]) * f,
  ]
  for (const strip of pairs) {
    for (let row = 0; row < strip.length - 1; row++) {
      const a = strip[row]
      const b = strip[row + 1]
      if (!a || !b) continue
      const depth = k.depthOf(lerp([a[0]!, b[1]!], 0.5), P) + 0.4
      items.push({
        depth,
        key: `<path class="an-cut" data-part="shell" d="`,
        d: path([a[0]!, a[1]!, b[1]!, b[0]!], true),
      })
      for (const fraction of [0.28, 0.6]) {
        items.push({
          depth: depth + 0.01,
          key: `<path class="iso-line" data-tone="faint" d="`,
          d: path([lerp(a, fraction), lerp(b, fraction)]),
        })
      }
      items.push({
        depth: depth + 0.02,
        key: `<path class="iso-line an-edge" data-tone="mid" data-part="shell" d="`,
        d: path([a[1]!, b[1]!]),
      })
    }
  }
  return items
}

type Organ = {
  part: AnatomyPart
  param: Param
  style: Partial<SurfaceStyle> & { rows: number; columns: number }
}

function organs(open: number, mantle: number): Organ[] {
  const shape = getShape(100)
  const list: Organ[] = []
  const blob = (
    part: AnatomyPart,
    center: Point3,
    radii: Point3,
    detail: [number, number] = [14, 18],
    yaw = 0,
    pitch = 0,
  ) =>
    list.push({
      part,
      param: ellipsoid(center, radii, yaw, pitch),
      style: { rows: detail[0], columns: detail[1], wrap: true, center },
    })
  const duct = (
    part: AnatomyPart,
    curve: (t: number) => Point3,
    radius: (t: number) => number,
    rows = 26,
    rims = false,
  ) =>
    list.push({
      part,
      param: tubeAlong(curve, radius),
      style: {
        rows,
        columns: 12,
        wrap: true,
        rims,
        edge: 'mid',
        spine: (u) => curve(Math.min(0.999, Math.max(0.001, u))),
      },
    })

  blob('foot', [-6, 0, 6], [70, 33, 6.5], [28, 56])
  list.push({
    part: 'foot',
    param: ellipsoid(at(-10, 0, -15), [48, 17, 9]),
    style: { rows: 22, columns: 40, wrap: true, doubleSided: true, soft: true },
  })
  list.push({
    part: 'visceral',
    param: ellipsoid(at(16, -3, 3), [38, 22, 19], 0, 0.08),
    style: { rows: 26, columns: 44, wrap: true, doubleSided: true, soft: true },
  })
  blob('head', at(-62, 0, -20), [11, 10, 7], [20, 30])
  for (const side of [-1, 1]) {
    duct(
      'head',
      bend(
        at(-66, side * 5, -16),
        at(-76, side * 8, -10),
        at(-86, side * 15, -9),
      ),
      (t) => 2.1 - 1.4 * t,
      20,
    )
    blob('head', at(-68, side * 9, -16.4), [2, 2, 2], [10, 12])
  }
  blob('siphon', at(-60, 0, 0), [11, 3.6, 3.4], [14, 20], 0, -0.55)
  if (open > 0.15) {
    const whorl = (t: number) => {
      const angle = t * Math.PI * 4.5
      const radius = 2 + t * 11
      return at(
        50 - t * 8,
        Math.cos(angle) * radius * 0.9,
        8 + Math.sin(angle) * radius * 0.9,
      )
    }
    list.push({
      part: 'shell',
      param: tubeAlong(whorl, (t) => 1.2 + 2.4 * t, [1, 0, 0]),
      style: {
        rows: 80,
        columns: 10,
        wrap: true,
        rims: false,
        soft: false,
        edge: 'mid',
        spine: (u) => whorl(Math.min(0.999, Math.max(0.001, u))),
      },
    })
    blob('digestive', at(22, -5, 6), [26, 14, 13], [16, 22], 0.05, 0.12)
    blob('gonad', at(41, -9, -2), [12, 9, 8], [12, 16])
    blob('stomach', at(4, -7, 1), [10, 8.5, 8], [12, 16])
    blob('kidney', at(-3, -13, 13), [9, 6, 6], [10, 14])
    blob('heart', at(9, -15, 15), [6, 5, 5], [10, 14])
    for (let index = 0; index < 18; index++) {
      const x = -40 + index * 2.1
      blob('gill', at(x, -12, 16), [0.75, 4.5, 6.5], [6, 10], 0.3)
    }
    blob('osphradium', at(-44, -4, 13), [8, 2.4, 2], [8, 12])
    blob('radula', at(-60, 0, -19), [6, 5, 4], [10, 14])
    duct(
      'radula',
      bend(at(-61, 0, -20), at(-56, 3, -26), at(-46, 0, -21)),
      () => 1.1,
      14,
    )
    duct(
      'gut',
      bend(at(-56, 0, -16), at(-28, -3, -10), at(2, -7, 1)),
      () => 2,
      28,
    )
    duct(
      'gut',
      bend(at(6, -3, 8), at(-12, 4, 16), at(-28, -5, 16)),
      () => 2.2,
      24,
    )
  }
  const coverage = mantle / 100
  if (coverage > 0.01) {
    const limit = Math.PI - shape.opening
    for (const side of [-1, 1]) {
      list.push({
        part: 'mantle',
        param: (u, v) => {
          const theta = side * (limit - v * limit * coverage)
          const p = shellPoint(u * 0.94 + 0.03, theta, 100, -0.035)
          return place([p.x, p.y, p.z])
        },
        style: {
          rows: 40,
          columns: 14,
          doubleSided: true,
          rims: true,
          center: cowrieCenter(100, place),
          soft: true,
        },
      })
    }
  }
  return list
}

function plinth(P: Projection) {
  const S = k.solidSvg
  const L = k.lineSvg
  const D = k.dotsSvg
  const out: string[] = []
  const low = -SLAB_H - FOOT_H
  out.push(`<path class="iso-halo" d="${k.haloOf(SLAB, low, SLAB_H, P)}"/>`)
  for (const [x, y] of k.corners(SLAB, 16)) {
    out.push(S(k.cylinder(x, y, 7, low, 1.6, P, 24), { tone: 'lo' }))
    out.push(
      S(k.cylinder(x, y, 5.4, low + 1.6, FOOT_H - 1.6, P, 24), { tone: 'mid' }),
    )
  }
  out.push(S(k.slabOf(SLAB, -SLAB_H, SLAB_H, P, 8, 1.2), { tone: 'mid' }))
  out.push(L(k.sideSeam(SLAB, -SLAB_H + 4, P, 8), { tone: 'faint' }))
  out.push(L(k.planOutline(k.insetPlan(SLAB, 5), 0, P), { tone: 'faint' }))
  const screws = k.corners(SLAB, 9)
  out.push(
    L(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 14)).join(''), {
      tone: 'lo',
    }),
  )
  out.push(
    D(
      screws.map(([x, y]) => k.iso([x, y, 0], P)),
      { size: 0.5 },
    ),
  )
  const strip: Plan = { x: -92, y: SLAB.y + SLAB.d - 11, w: 170, d: 6, r: 0.8 }
  out.push(S(k.slabOf(strip, 0, 0.5, P, 2), { tone: 'lo', crease: 'none' }))
  const ticks = k.topTicks(
    strip.x + 2,
    strip.x + 162,
    2,
    5,
    strip.y + 0.4,
    0.5,
    [1.8, 3.4],
    P,
  )
  out.push(L(ticks.minor, { tone: 'lo' }), L(ticks.major, { tone: 'mid' }))
  const face = SLAB.y + SLAB.d
  const label: Plan = { x: -30, y: face, w: 56, d: 1, r: 0.4 }
  out.push(S(k.slabOf(label, -SLAB_H + 3, 8, P, 2, 0.3), { tone: 'mid' }))
  for (const [index, z] of [-5.6, -8.4].entries()) {
    out.push(
      L(
        k.segment(
          [label.x + 5, face + 1.1, z],
          [label.x + label.w - (index ? 24 : 9), face + 1.1, z],
          P,
        ),
        {
          tone: index ? 'faint' : 'lo',
          free: true,
        },
      ),
    )
  }
  out.push(
    D(
      [
        [label.x + 2.2, -4],
        [label.x + label.w - 2.2, -4],
        [label.x + 2.2, -9.6],
        [label.x + label.w - 2.2, -9.6],
      ].map(([x, z]) => k.iso([x!, face + 1, z!], P)),
      { size: 0.42, tone: 'mid' },
    ),
  )
  const rest = k.iso([-6, 0, 0], P)
  out.push(
    `<ellipse class="iso-halo an-rest" cx="${rest[0].toFixed(1)}" cy="${rest[1].toFixed(1)}" rx="${(k.screenRise(1, P) * 76).toFixed(1)}" ry="${(k.screenRise(1, P) * 24).toFixed(1)}"/>`,
  )
  return out.join('')
}

export function cutawaySvg(open: number, mantle: number, P: Projection) {
  const Y = cutPlane(open)
  const clip = cutClip(open)
  const items: Item[] = []
  items.push(
    ...cowrieItems(100, place, P, {
      part: 'shell',
      clip,
      spotCount: 260,
      detail: [56, 52],
      lining: true,
    }),
  )
  if (clip) items.push(...sectionItems(Y, P))
  for (const organ of organs(open, mantle)) {
    const cuttable =
      organ.part === 'mantle' ||
      organ.part === 'visceral' ||
      (organ.part === 'foot' && organ.style.doubleSided)
    const style: SurfaceStyle = {
      edge: 'hi',
      soft: organ.part !== 'shell',
      ...organ.style,
      part: organ.part,
      clip: cuttable ? clip : undefined,
    }
    const facets = surfaceItems(organ.param, P, style)
    if (organ.part === 'mantle' || organ.part === 'shell') items.push(...facets)
    else {
      const fills = facets.filter((item) => item.key?.includes('an-q'))
      const depth =
        fills.reduce((sum, item) => sum + item.depth, 0) /
        Math.max(1, fills.length)
      items.push(...layer(facets, depth))
    }
    if (organ.part === 'mantle') {
      for (let index = 0; index < 90; index++) {
        const u = ((index * 0.6180339) % 1) * 0.9 + 0.05
        const v = ((index * 0.7548777) % 1) * 0.86 + 0.1
        const point = organ.param(u, v)
        if (clip && beyond(clip, point) > 0) continue
        const mark = markItem(organ.param, P, u, v, [1.5, 1.5], 0, {
          center: cowrieCenter(100, place),
          className: 'an-papilla',
          lift: 0.6,
        })
        if (mark) items.push(mark)
      }
    }
  }
  return plinth(P) + paint(items)
}

/** Points on screen to anchor pointer selection for each part. */
export function partAnchors(open: number, P: Projection) {
  const anchors: Partial<Record<AnatomyPart, Point3>> = {
    shell: at(10, -6, 29),
    mantle: at(-6, 26, -6),
    foot: [30, 26, 8],
    head: at(-76, 6, -14),
    siphon: at(-64, 0, 3),
  }
  if (open > 0.4) {
    Object.assign(anchors, {
      gill: at(-22, -12, 16),
      osphradium: at(-44, -4, 13),
      heart: at(9, -15, 15),
      kidney: at(-3, -13, 13),
      stomach: at(4, -7, 1),
      digestive: at(22, -5, 10),
      gonad: at(41, -9, -2),
      gut: at(-26, -3, -9),
      radula: at(-58, 2, -24),
    })
  }
  return Object.entries(anchors).map(([part, point]) => ({
    part: part as AnatomyPart,
    at: k.iso(point!, P),
  }))
}
