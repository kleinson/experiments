import * as k from './kit/iso-kit.ts'
import type { Plan, Plane, Point3, Projection } from './kit/iso-kit.ts'

export const WALL = { width: 680, height: 450 }

/**
 * Illustrative layers of a cowrie shell wall, innermost first. Thickness and
 * lamella spacing are drawing units, not measurements.
 */
export const wallLayers = [
  { id: 'inner', label: 'Inner mineral layer', height: 10, angle: 0, gap: 5.2 },
  {
    id: 'middle',
    label: 'Middle mineral layer',
    height: 13,
    angle: 45,
    gap: 5.6,
  },
  {
    id: 'outer',
    label: 'Outer mineral layer',
    height: 11,
    angle: -45,
    gap: 5.6,
  },
  {
    id: 'glaze',
    label: 'Glossy coat laid by the mantle',
    height: 5,
    angle: 0,
    gap: 0,
  },
] as const

const BLOCK: Plan = { x: 0, y: 0, w: 168, d: 100, r: 0 }
const STEP = 17
const FLUID = 4
const CELL = 6.4
const CELL_H = 8
const TISSUE_H = 9
const PLINTH: Plan = { x: -14, y: -14, w: BLOCK.w + 28, d: BLOCK.d + 28, r: 5 }
const PLINTH_H = 8

const tops = wallLayers.reduce<number[]>((list, layer) => {
  list.push((list[list.length - 1] ?? 0) + layer.height)
  return list
}, [])
const regionOf = (index: number): Plan => ({
  x: BLOCK.x,
  y: BLOCK.y,
  w: BLOCK.w - STEP * index,
  d: BLOCK.d - STEP * index,
  r: 0,
})

export function wallProjection(): Projection {
  const top = tops[tops.length - 1]! + FLUID + CELL_H + TISSUE_H + 6
  return k.fitProjection(
    [...k.boxCorners(PLINTH, -PLINTH_H - 4, 0), ...k.boxCorners(BLOCK, 0, top)],
    WALL.width,
    WALL.height,
    { pad: 18, azimuth: 40, elevation: 32 },
  )
}

/** Clips a convex polygon to an axis-aligned rectangle on the floor. */
function clipToPlan(polygon: Plane[], plan: Plan): Plane[] {
  let points = polygon
  const edges: [(p: Plane) => number, number][] = [
    [(p) => p[0] - plan.x, 0],
    [(p) => plan.x + plan.w - p[0], 0],
    [(p) => p[1] - plan.y, 0],
    [(p) => plan.y + plan.d - p[1], 0],
  ]
  for (const [inside] of edges) {
    const next: Plane[] = []
    for (let index = 0; index < points.length; index++) {
      const a = points[index]!
      const b = points[(index + 1) % points.length]!
      const da = inside(a)
      const db = inside(b)
      if (da >= 0) next.push(a)
      if (da >= 0 !== db >= 0) {
        const t = da / (da - db)
        next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
      }
    }
    points = next
    if (points.length < 3) return []
  }
  return points
}

/** Thin vertical plates crossing a region at an angle: one layer's lamellae. */
function lamellae(region: Plan, angle: number, gap: number) {
  const radians = (angle * Math.PI) / 180
  const along: Plane = [Math.cos(radians), Math.sin(radians)]
  const across: Plane = [-along[1], along[0]]
  const middle: Plane = [region.x + region.w / 2, region.y + region.d / 2]
  const reach = Math.hypot(region.w, region.d)
  const plates: Plane[][] = []
  const thick = gap - 0.7
  for (let offset = -reach / 2; offset < reach / 2; offset += gap) {
    const corner = (s: number, t: number): Plane => [
      middle[0] + along[0] * s + across[0] * t,
      middle[1] + along[1] * s + across[1] * t,
    ]
    const plate = clipToPlan(
      [
        corner(-reach, offset),
        corner(reach, offset),
        corner(reach, offset + thick),
        corner(-reach, offset + thick),
      ],
      region,
    )
    if (plate.length >= 3) plates.push(plate)
  }
  return plates
}

function spread(seed: number) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

export function wallSvg(growth: number, P: Projection) {
  const S = k.solidSvg
  const L = k.lineSvg
  const D = k.dotsSvg
  const at = (point: Point3) => k.iso(point, P)
  const byDepth = <T>(list: T[], point: (item: T) => Point3) =>
    [...list].sort((a, b) => k.depthOf(point(a), P) - k.depthOf(point(b), P))
  const centroid = (ring: Plane[]): Plane => [
    ring.reduce((sum, p) => sum + p[0], 0) / ring.length,
    ring.reduce((sum, p) => sum + p[1], 0) / ring.length,
  ]
  const out: string[] = []

  out.push(
    `<path class="iso-halo" d="${k.haloOf(PLINTH, -PLINTH_H - 4, PLINTH_H, P)}"/>`,
  )
  for (const [x, y] of k.corners(PLINTH, 14)) {
    out.push(S(k.cylinder(x, y, 6, -PLINTH_H - 4, 1.4, P, 24), { tone: 'lo' }))
    out.push(
      S(k.cylinder(x, y, 4.6, -PLINTH_H - 2.6, 2.6, P, 24), { tone: 'mid' }),
    )
  }
  out.push(S(k.slabOf(PLINTH, -PLINTH_H, PLINTH_H, P, 6, 1), { tone: 'mid' }))
  out.push(
    L(k.planOutline(k.insetPlan(PLINTH, 4.5), 0, P, 6), { tone: 'faint' }),
  )
  const screws = k.corners(PLINTH, 7)
  out.push(
    L(screws.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 12)).join(''), {
      tone: 'lo',
    }),
  )
  out.push(
    D(
      screws.map(([x, y]) => at([x, y, 0])),
      { size: 0.45 },
    ),
  )
  const strip: Plan = { x: 6, y: PLINTH.y + PLINTH.d - 9, w: 150, d: 5, r: 0.6 }
  out.push(S(k.slabOf(strip, 0, 0.4, P, 2), { tone: 'lo', crease: 'none' }))
  const ticks = k.topTicks(
    strip.x + 2,
    strip.x + 146,
    2,
    5,
    strip.y + 0.3,
    0.4,
    [1.6, 3],
    P,
  )
  out.push(L(ticks.minor, { tone: 'lo' }), L(ticks.major, { tone: 'mid' }))

  let z = 0
  wallLayers.forEach((layer, index) => {
    const region = regionOf(index)
    const height = layer.height
    if (layer.gap > 0) {
      const plates = lamellae(region, layer.angle, layer.gap)
      for (const plate of byDepth(plates, (ring) => [...centroid(ring), z])) {
        out.push(
          S(k.extrude(plate, z, height, P), {
            tone: 'mid',
            crease: 'faint',
          }),
        )
      }
      out.push(L(k.sideSeam(region, z + 0.2, P, 2), { tone: 'lo' }))
    } else if (growth >= 0.98) {
      out.push(S(k.slabOf(region, z, height, P, 2, 0.5), { tone: 'hi' }))
      const random = spread(97)
      for (let spot = 0; spot < 24; spot++) {
        const x = region.x + 6 + random() * (region.w - 12)
        const y = region.y + 6 + random() * (region.d - 12)
        const r = 1.2 + random() * 3.2
        out.push(
          `<path class="an-spot" opacity="0.8" d="${k.pathOf(
            k
              .circleRing(x, y, r, 14)
              .map(([px, py]) => at([px, py, z + height])),
            true,
          )}"/>`,
        )
      }
    } else if (growth > 0.01) {
      const columns = 16
      const rows = 7
      const crystals: { plan: Plan; h: number }[] = []
      for (let column = 0; column < columns; column++) {
        for (let row = 0; row < rows; row++) {
          const stagger = (Math.sin(column * 2.3 + row * 1.7) + 1) / 2
          const h =
            layer.height *
            Math.max(0.04, Math.min(1, growth * 1.45 - stagger * 0.45))
          const w = region.w / columns
          const d = region.d / rows
          crystals.push({
            plan: {
              x: region.x + column * w + 0.3,
              y: region.y + row * d + 0.3,
              w: w - 0.6,
              d: d - 0.6,
              r: 0.4,
            },
            h,
          })
        }
      }
      for (const crystal of byDepth(crystals, (item) => [
        item.plan.x + item.plan.w / 2,
        item.plan.y + item.plan.d / 2,
        z,
      ])) {
        out.push(
          S(k.slabOf(crystal.plan, z, crystal.h, P, 2, 0.3), {
            tone: 'mid',
            crease: 'faint',
          }),
        )
      }
    }
    z += height
  })

  const newest = regionOf(wallLayers.length - 1)
  const fluidTop = tops[tops.length - 1]! + FLUID
  out.push(
    L(k.planOutline(newest, z + 0.15, P, 2), { tone: 'lo', dotted: true }),
  )
  const cells: Plan[] = []
  for (let x = newest.x; x + CELL <= newest.x + newest.w + 0.01; x += CELL) {
    for (let y = newest.y; y + CELL <= newest.y + newest.d + 0.01; y += CELL) {
      cells.push({
        x: x + 0.35,
        y: y + 0.35,
        w: CELL - 0.7,
        d: CELL - 0.7,
        r: 1.4,
      })
    }
  }
  const cellZ = fluidTop
  for (const cell of byDepth(cells, (plan) => [
    plan.x + plan.w / 2,
    plan.y + plan.d / 2,
    cellZ,
  ])) {
    out.push(
      S(k.slabOf(cell, cellZ, CELL_H, P, 3, 0.3), {
        tone: 'hi',
        lit: true,
        crease: 'faint',
      }),
    )
  }
  const tissue: Plan = {
    x: newest.x,
    y: newest.y,
    w: newest.w,
    d: newest.d,
    r: 0,
  }
  const tissueZ = cellZ + CELL_H
  out.push(
    S(k.slabOf(tissue, tissueZ, TISSUE_H, P, 2, 0.6), {
      tone: 'mid',
      crease: 'lo',
    }),
  )
  out.push(
    L(k.sideSeam(tissue, tissueZ + TISSUE_H * 0.5, P, 2), { tone: 'faint' }),
  )
  const papillae: Plane[] = []
  const pick = spread(53)
  for (let index = 0; index < 16; index++) {
    papillae.push([
      tissue.x + 8 + pick() * (tissue.w - 16),
      tissue.y + 8 + pick() * (tissue.d - 16),
    ])
  }
  for (const [x, y] of byDepth(papillae, ([x, y]) => [
    x,
    y,
    tissueZ + TISSUE_H,
  ])) {
    const top = tissueZ + TISSUE_H
    out.push(S(k.cylinder(x, y, 2.4, top, 1.2, P, 16), { tone: 'mid' }))
    out.push(
      S(k.cylinder(x, y, 1.3, top + 1.2, 4.2, P, 14), {
        tone: 'mid',
        crease: 'none',
      }),
    )
    out.push(D([at([x, y, top + 5.4])], { size: 0.5, tone: 'hi' }))
  }
  return out.join('')
}
