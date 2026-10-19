import { experience, getShape } from '../model.ts'
import { shellPoint } from '../shellform.ts'
import * as k from './kit/iso-kit.ts'
import type { Plan, Point3, Projection } from './kit/iso-kit.ts'
import { cowrieItems } from './cowrie.ts'
import { paint, placeShell } from './surface.ts'

export const DRAWER = { width: 680, height: 420 }

const CELL = { w: 132, d: 86 }
const WALL = 7
const DIVIDER = 2.6
const BASE_H = 7
const WALL_H = 20
const FRONT_H = 26
const BED_H = 6
const COLUMNS = 4
const ROWS = 2
const INNER = { x: 0, y: 0, w: CELL.w * COLUMNS, d: CELL.d * ROWS }
const OUTER: Plan = {
  x: -WALL,
  y: -WALL,
  w: INNER.w + WALL * 2,
  d: INNER.d + WALL * 2,
  r: 3,
}

/** Millimetres per model unit for a given adult reference length. */
const mmPerUnit = (lengthMm: number) => (lengthMm / 110) * (55 / 1.78)

export const stageProgress = experience.stages.map((stage) =>
  stage.startsAt === 75 ? 100 : stage.startsAt,
)

function lowest(progress: number, ventral: boolean) {
  let low = Infinity
  for (let u = 0.02; u < 1; u += 0.04) {
    for (let t = -Math.PI; t <= Math.PI; t += Math.PI / 24) {
      const y = shellPoint(u, t, progress).y
      low = Math.min(low, ventral ? -y : y)
    }
  }
  return low
}

export function drawerProjection(): Projection {
  return k.fitProjection(
    [
      ...k.boxCorners(OUTER, -BASE_H - 4, FRONT_H),
      [INNER.w / 2, INNER.d / 2, 48],
    ],
    DRAWER.width,
    DRAWER.height,
    { pad: 14, azimuth: 58, elevation: 40 },
  )
}

export function drawerSvg(lengthMm: number, P: Projection) {
  const S = k.solidSvg
  const L = k.lineSvg
  const D = k.dotsSvg
  const at = (point: Point3) => k.iso(point, P)
  const out: string[] = []

  out.push(
    `<path class="iso-halo" d="${k.haloOf(OUTER, -BASE_H - 4, BASE_H, P)}"/>`,
  )
  for (const x of [OUTER.x + 30, OUTER.x + OUTER.w - 46]) {
    out.push(
      S(
        k.slabOf(
          { x, y: OUTER.y + 6, w: 16, d: OUTER.d - 12, r: 1 },
          -BASE_H - 4,
          4,
          P,
          2,
        ),
        {
          tone: 'lo',
        },
      ),
    )
  }
  out.push(S(k.slabOf(OUTER, -BASE_H, BASE_H, P, 4, 0.8), { tone: 'mid' }))

  const back: Plan = { x: OUTER.x, y: OUTER.y, w: OUTER.w, d: WALL, r: 1.5 }
  const left: Plan = { x: OUTER.x, y: 0, w: WALL, d: INNER.d, r: 0.5 }
  const right: Plan = { x: INNER.w, y: 0, w: WALL, d: INNER.d, r: 0.5 }
  const front: Plan = {
    x: OUTER.x - 2,
    y: INNER.d,
    w: OUTER.w + 4,
    d: WALL + 2,
    r: 1.5,
  }
  out.push(S(k.slabOf(back, 0, WALL_H, P, 3, 0.6), { tone: 'mid' }))
  out.push(S(k.slabOf(left, 0, WALL_H, P, 3, 0.6), { tone: 'mid' }))
  out.push(
    L(k.planOutline({ x: 0, y: 0, w: INNER.w, d: INNER.d, r: 0 }, 0, P), {
      tone: 'faint',
    }),
  )

  const cell = (column: number, row: number): Plan => ({
    x: column * CELL.w + (column ? DIVIDER / 2 : 0),
    y: row * CELL.d + (row ? DIVIDER / 2 : 0),
    w:
      CELL.w -
      (column ? DIVIDER / 2 : 0) -
      (column < COLUMNS - 1 ? DIVIDER / 2 : 0),
    d: CELL.d - (row ? DIVIDER / 2 : 0) - (row < ROWS - 1 ? DIVIDER / 2 : 0),
    r: 0,
  })

  for (let row = 0; row < ROWS; row++) {
    const ventral = row === 1
    for (let column = 0; column < COLUMNS; column++) {
      const plan = cell(column, row)
      const bed = k.insetPlan({ ...plan, r: 8 }, 7)
      out.push(
        S(k.slabOf(bed, 0, BED_H, P, 6, 0.6), { tone: 'lo', crease: 'faint' }),
      )
      out.push(
        L(k.planOutline(k.insetPlan(bed, 4), BED_H, P, 6), { tone: 'faint' }),
      )
      const card: Plan = {
        x: plan.x + 8,
        y: plan.y + plan.d - 15,
        w: 30,
        d: 10,
        r: 0.6,
      }
      out.push(
        S(k.slabOf(card, BED_H, 0.6, P, 2), { tone: 'lo', crease: 'none' }),
      )
      for (const [index, line] of [0.32, 0.55, 0.78].entries()) {
        const y = card.y + card.d * line
        out.push(
          L(
            k.lineOnTop(
              [card.x + 3, y],
              [card.x + card.w - (index === 2 ? 14 : 4), y],
              BED_H + 0.6,
              P,
            ),
            { tone: index ? 'faint' : 'lo', free: true },
          ),
        )
      }
      const progress = stageProgress[column]!
      const shape = getShape(progress)
      const size = mmPerUnit(lengthMm)
      const sink = 1.4
      const lift = BED_H - lowest(progress, ventral) * size - sink
      const middle: Point3 = [
        plan.x + plan.w / 2 + 4,
        plan.y + plan.d / 2 - 6,
        lift,
      ]
      out.push(
        `<ellipse class="iso-halo an-rest" cx="${at([middle[0], middle[1], BED_H])[0]}" cy="${at([middle[0], middle[1], BED_H])[1]}" rx="${(1.78 * shape.scale * size * 0.95).toFixed(1)}" ry="${(1.78 * shape.scale * size * 0.32).toFixed(1)}"/>`,
      )
      out.push(
        paint(
          cowrieItems(
            progress,
            placeShell(middle, size, { ventral, yaw: 0 }),
            P,
            {
              part: `stage-${column}`,
              detail: [28, 26],
              spotCount: ventral ? 110 : 170,
              cavity: ventral,
              layered: true,
            },
          ),
        ),
      )
      if (column < COLUMNS - 1) {
        const x = (column + 1) * CELL.w - DIVIDER / 2
        const divider: Plan = {
          x,
          y: plan.y - (row ? DIVIDER / 2 : 0),
          w: DIVIDER,
          d: plan.d + (row ? DIVIDER / 2 : DIVIDER / 2),
          r: 0.3,
        }
        out.push(
          S(k.slabOf(divider, 0, WALL_H - 6, P, 2, 0.3), { tone: 'mid' }),
        )
      }
    }
    if (row < ROWS - 1) {
      const divider: Plan = {
        x: 0,
        y: CELL.d - DIVIDER / 2,
        w: INNER.w,
        d: DIVIDER,
        r: 0.3,
      }
      out.push(S(k.slabOf(divider, 0, WALL_H - 6, P, 2, 0.3), { tone: 'mid' }))
      for (let column = 1; column < COLUMNS; column++) {
        const x = column * CELL.w
        out.push(D([at([x, CELL.d, WALL_H - 6])], { size: 0.5, tone: 'mid' }))
      }
    }
  }

  out.push(S(k.slabOf(right, 0, WALL_H, P, 3, 0.6), { tone: 'mid' }))
  out.push(
    L(
      [8, 16]
        .map((z) =>
          k.segment([INNER.w + WALL, 4, z], [INNER.w + WALL, INNER.d, z], P),
        )
        .join(''),
      { tone: 'faint' },
    ),
  )

  out.push(
    S(k.slabOf(front, -BASE_H, FRONT_H + BASE_H, P, 3, 0.8), { tone: 'mid' }),
  )
  const face = front.y + front.d
  out.push(
    L(
      k.segment(
        [front.x + 6, face, FRONT_H - 6],
        [front.x + front.w - 6, face, FRONT_H - 6],
        P,
      ),
      { tone: 'faint' },
    ),
  )
  for (const x of [front.x + 10, front.x + front.w - 10]) {
    out.push(
      L(k.segment([x, face, -BASE_H], [x, face, FRONT_H], P), {
        tone: 'faint',
      }),
    )
  }

  const strip: Plan = { x: 30, y: INNER.d + 1.4, w: 240, d: 5.4, r: 0.6 }
  out.push(
    S(k.slabOf(strip, FRONT_H, 0.5, P, 2), { tone: 'lo', crease: 'none' }),
  )
  const ticks = k.topTicks(
    strip.x + 2,
    strip.x + 2 + 230,
    2,
    5,
    strip.y + 0.4,
    FRONT_H + 0.5,
    [1.6, 3],
    P,
  )
  out.push(L(ticks.minor, { tone: 'lo' }), L(ticks.major, { tone: 'mid' }))
  out.push(
    D(
      [
        at([strip.x + 1, strip.y + 2.7, FRONT_H + 0.5]),
        at([strip.x + strip.w - 1, strip.y + 2.7, FRONT_H + 0.5]),
      ],
      { size: 0.4 },
    ),
  )

  const holderX = OUTER.x + 44
  const holder: Plan = { x: holderX, y: face, w: 70, d: 1.4, r: 0.4 }
  out.push(S(k.slabOf(holder, 4, 18, P, 2, 0.3), { tone: 'mid' }))
  const label: Plan = { x: holderX + 4, y: face + 1.4, w: 62, d: 0.5, r: 0.2 }
  out.push(S(k.slabOf(label, 7, 12, P, 2), { tone: 'lo', crease: 'none' }))
  for (const [index, z] of [16, 12.5, 9.5].entries()) {
    out.push(
      L(
        k.segment(
          [label.x + 5, face + 1.9, z],
          [label.x + label.w - (index ? 22 : 8), face + 1.9, z],
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
        at([holderX + 2.4, face + 1.4, 20]),
        at([holderX + 67.6, face + 1.4, 20]),
        at([holderX + 2.4, face + 1.4, 6]),
        at([holderX + 67.6, face + 1.4, 6]),
      ],
      { size: 0.45, tone: 'mid' },
    ),
  )

  const pullX = OUTER.x + OUTER.w / 2 + 120
  for (const x of [pullX, pullX + 56]) {
    out.push(
      S(k.slabOf({ x: x - 3, y: face, w: 6, d: 5, r: 1.2 }, 9, 7, P, 3, 0.3), {
        tone: 'mid',
      }),
    )
  }
  out.push(
    S(
      k.slabOf(
        { x: pullX - 4, y: face + 5, w: 64, d: 5, r: 2 },
        8.5,
        8,
        P,
        4,
        0.6,
      ),
      { tone: 'hi' },
    ),
  )
  out.push(
    D([at([pullX, face + 0.1, 12.5]), at([pullX + 56, face + 0.1, 12.5])], {
      size: 0.45,
    }),
  )

  const corners = [
    [OUTER.x + 3.5, OUTER.y + 3.5],
    [OUTER.x + OUTER.w - 3.5, OUTER.y + 3.5],
    [OUTER.x + 3.5, INNER.d - 3],
    [OUTER.x + OUTER.w - 3.5, INNER.d - 3],
  ] as const
  out.push(
    L(corners.map(([x, y]) => k.ring(x, y, 1.6, WALL_H, P, 12)).join(''), {
      tone: 'lo',
    }),
  )
  out.push(
    D(
      corners.map(([x, y]) => at([x, y, WALL_H])),
      { size: 0.45 },
    ),
  )

  return out.join('')
}

/** Screen polygons over each stage column, for pointer selection. */
export function drawerTargets(P: Projection) {
  return Array.from({ length: COLUMNS }, (_, column) => {
    const x0 = column * CELL.w
    const x1 = x0 + CELL.w
    const points: Point3[] = [
      [x0, 0, 0],
      [x1, 0, 0],
      [x1, INNER.d, 0],
      [x0, INNER.d, 0],
      [x0, INNER.d, 70],
      [x0, 0, 70],
      [x1, 0, 70],
    ]
    const flat = points.map((point) => k.iso(point, P))
    const hull = flat.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
    return {
      stage: column,
      d: k.pathOf(hullOf(hull), true),
    }
  })
}

function hullOf(sorted: [number, number][]) {
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!)
  const lower: [number, number][] = []
  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0
    )
      lower.pop()
    lower.push(point)
  }
  const upper: [number, number][] = []
  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index]!
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0
    )
      upper.pop()
    upper.push(point)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}
