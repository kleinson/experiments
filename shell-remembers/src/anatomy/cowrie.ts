import { getShape } from '../model.ts'
import { makeSpots, shellPoint } from '../shellform.ts'
import { iso } from './kit/iso-kit.ts'
import type { Point3, Projection } from './kit/iso-kit.ts'
import { beyond, layer, markItem, surfaceItems, vec } from './surface.ts'
import type { Clip, Item, Param, Transform } from './surface.ts'

const spots = makeSpots(420)

export type CowrieOptions = {
  lit?: boolean
  part?: string
  /** Resolution: rows along the shell, columns around it. */
  detail?: [number, number]
  spotCount?: number
  /** Clips the shell exactly against a section plane (cutaways). */
  clip?: Clip
  bias?: number
  /** Draws the inner cavity, needed only where the aperture can be seen. */
  cavity?: boolean
  /** Paints a whole specimen in fixed layers instead of sorting facets. */
  layered?: boolean
  /** Shades the inside as lit porcelain (a cutaway) rather than a dark opening. */
  lining?: boolean
}

const model = (progress: number, place: Transform) => {
  const shape = getShape(progress)
  const min = -Math.PI + shape.opening
  const max = Math.PI - shape.opening
  const theta = (v: number) => min + (max - min) * v
  const toWorld = (p: { x: number; y: number; z: number }): Point3 =>
    place([p.x, p.y, p.z])
  const outer: Param = (u, v) => toWorld(shellPoint(u, theta(v), progress))
  const inner: Param = (u, v) =>
    toWorld(shellPoint(u, theta(v), progress, 0.035))
  return { shape, min, max, theta, toWorld, outer, inner }
}

export function cowrieCenter(progress: number, place: Transform): Point3 {
  const shape = getShape(progress)
  return place([0, 0.12 * shape.scale, 0])
}

/** A tube around a model-space curve, for the juvenile's attached spire. */
function tube(
  curve: (t: number) => Point3,
  radius: (t: number) => number,
  place: Transform,
): Param {
  return (u, v) => {
    const t = Math.min(0.999, Math.max(0.001, u))
    const here = curve(t)
    const tangent = vec.unit(vec.sub(curve(t + 0.001), curve(t - 0.001)))
    const side = vec.unit(vec.cross(tangent, [0, 1, 0.3]))
    const up = vec.cross(side, tangent)
    const angle = v * Math.PI * 2
    const r = radius(t)
    return place(
      vec.add(
        here,
        vec.add(
          vec.scale(side, Math.cos(angle) * r),
          vec.scale(up, Math.sin(angle) * r),
        ),
      ),
    )
  }
}

export function cowrieItems(
  progress: number,
  place: Transform,
  P: Projection,
  options: CowrieOptions = {},
): Item[] {
  const { shape, outer, inner, theta, toWorld } = model(progress, place)
  const ends = [iso(outer(0, 0.5), P), iso(outer(1, 0.5), P)]
  const screenLength = Math.hypot(
    ends[1]![0] - ends[0]![0],
    ends[1]![1] - ends[0]![1],
  )
  const rows =
    options.detail?.[0] ??
    Math.round(Math.min(64, Math.max(22, screenLength / 3.2)))
  const columns = options.detail?.[1] ?? Math.round(rows * 0.92)
  const center = cowrieCenter(progress, place)
  const bias = options.bias ?? 0
  const clip = options.clip
  const hide = clip ? (point: Point3) => beyond(clip, point) > 0 : undefined
  const cavity: Item[] = []
  const shell = surfaceItems(outer, P, {
    rows,
    columns,
    center,
    lit: options.lit,
    part: options.part,
    edge: 'hi',
    rims: false,
    bias,
    clip,
  })
  if (options.cavity !== false)
    cavity.push(
      ...surfaceItems(inner, P, {
        clip,
        rows,
        columns,
        center,
        inward: true,
        recess: !options.lining,
        edge: 'none',
        bias: bias - 0.05,
      }),
    )
  const lips: Item[] = []
  const teeth: Item[] = []
  const length = vec.sub(outer(1, 0.5), outer(0, 0.5))
  const span = Math.hypot(length[0], length[1], length[2])
  const underside = options.cavity !== false
  for (const side of underside ? [0, 1] : []) {
    const edgeTheta = theta(side)
    const lip: Param = (u, w) => {
      const a = shellPoint(u, edgeTheta, progress)
      const b = shellPoint(u, edgeTheta, progress, 0.035 * w)
      return toWorld({
        x: a.x + (b.x - a.x) * w,
        y: a.y + (b.y - a.y) * w,
        z: a.z + (b.z - a.z) * w,
      })
    }
    lips.push(
      ...surfaceItems(lip, P, {
        rows,
        columns: 2,
        doubleSided: true,
        edge: options.lit ? 'hi' : 'mid',
        lit: options.lit,
        part: options.part,
        rims: true,
        bias: bias + 0.02,
      }),
    )
  }
  if (underside && shape.teeth > 0.02) {
    for (const side of [0, 1]) {
      for (let tooth = 0; tooth < 26; tooth++) {
        const u = 0.12 + (tooth / 25) * 0.76
        const v = side ? 0.985 : 0.015
        const mark = markItem(
          outer,
          P,
          u,
          v,
          [span * 0.0045, span * (0.01 + 0.032 * shape.teeth)],
          0,
          {
            center,
            className: 'an-tooth',
            opacity: Math.min(1, shape.teeth * 1.6),
            lift: span * 0.002,
          },
        )
        if (mark) teeth.push({ ...mark, depth: mark.depth + bias + 0.03 })
      }
    }
  }
  const spire: Item[] = []
  if (shape.coilVisibility > 0) {
    const coil = tube(
      (t) => {
        const angle = t * Math.PI * 3.5
        const radius = 0.04 + t * 0.34
        return [
          (1.88 - t * 0.28) * shape.scale,
          Math.cos(angle) * radius * 0.82 * shape.scale,
          Math.sin(angle) * radius * shape.scale,
        ]
      },
      (t) => (0.03 + 0.03 * t) * shape.scale,
      place,
    )
    spire.push(
      ...surfaceItems(coil, P, {
        rows: 54,
        columns: 8,
        wrap: true,
        center: undefined,
        edge: 'mid',
        bias: bias + 0.04,
        lit: options.lit,
        part: options.part,
        rims: false,
      }),
    )
  }
  const marks: Item[] = []
  const count = options.spotCount ?? 150
  for (const spot of spots.slice(0, count)) {
    if (hide && hide(outer(spot.u, spot.v))) continue
    const a = spot.size * span * 1.4
    const mark = markItem(
      outer,
      P,
      spot.u,
      spot.v,
      [a, a * spot.stretch * 0.7],
      spot.angle,
      { center, opacity: spot.opacity * 0.9 },
    )
    if (mark) marks.push({ ...mark, depth: mark.depth + bias })
  }
  if (!options.layered)
    return [...cavity, ...shell, ...lips, ...teeth, ...spire, ...marks]
  const ordered = spire
    .sort((a, b) => a.depth - b.depth)
    .map((item, index) => ({ ...item, depth: 5 + index * 1e-6 }))
  return [
    ...layer(cavity, 0),
    ...layer(shell, 1),
    ...layer(marks, 2),
    ...layer(lips, 3),
    ...layer(teeth, 4),
    ...ordered,
  ]
}
