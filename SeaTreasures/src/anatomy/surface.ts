import { cameraOf, depthOf, iso } from './kit/iso-kit.ts'
import type { Flat, Point3, Projection } from './kit/iso-kit.ts'

/**
 * One drawable thing, painted back to front by `depth`. Items that share a
 * `key` and end up adjacent in paint order are merged into one path.
 */
export type Item = { depth: number; svg?: string; key?: string; d?: string }

export type Param = (u: number, v: number) => Point3

export type SurfaceStyle = {
  rows: number
  columns: number
  /** Joins the last column back to the first, like a closed tube. */
  wrap?: boolean
  /** Shows the far side of a sheet instead of hiding it (cavities, linings). */
  doubleSided?: boolean
  /** A point inside the body, so every facet's normal can point outward. */
  center?: Point3
  /** For tubes: the centre line, so facets point away from it. */
  spine?: (u: number) => Point3
  /** The one accent part the reader should watch. */
  lit?: boolean
  /** Inner faces (seen from behind) are drawn as recess. */
  recess?: boolean
  /** Normals point toward `center`: a lining seen from inside. */
  inward?: boolean
  /** Tone for the silhouette and rims. */
  edge?: 'hi' | 'mid' | 'lo' | 'faint' | 'none'
  /** Whether open boundary rows/columns get a rim line. */
  rims?: boolean
  bias?: number
  /** Optional extra attribute for hover/selection hooks. */
  part?: string
  /** Draw with a lighter tone family, for tissue under a shell. */
  soft?: boolean
  /** Removes facets whose centre this accepts: a cutaway. The cut gets a rim. */
  hide?: (middle: Point3) => boolean
  /** Clips facets exactly against a plane, keeping dot(normal, p - origin) <= offset. */
  clip?: Clip
}

export type Clip = { normal: Point3; origin: Point3; offset: number }
export const beyond = (clip: Clip, point: Point3) =>
  dot(clip.normal, sub(point, clip.origin)) - clip.offset

function clipPolygon(points: Point3[], clip: Clip): Point3[] {
  const out: Point3[] = []
  for (let index = 0; index < points.length; index++) {
    const a = points[index]!
    const b = points[(index + 1) % points.length]!
    const da = beyond(clip, a)
    const db = beyond(clip, b)
    if (da <= 0) out.push(a)
    if (da <= 0 !== db <= 0) {
      const t = da / (da - db)
      out.push(add(a, scale(sub(b, a), t)))
    }
  }
  return out
}

function clipSegment(
  a: Point3,
  b: Point3,
  clip: Clip,
): [Point3, Point3] | null {
  const da = beyond(clip, a)
  const db = beyond(clip, b)
  if (da > 0 && db > 0) return null
  if (da <= 0 && db <= 0) return [a, b]
  const t = da / (da - db)
  const cut = add(a, scale(sub(b, a), t))
  return da <= 0 ? [a, cut] : [cut, b]
}

const sub = (a: Point3, b: Point3): Point3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
]
const add = (a: Point3, b: Point3): Point3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
]
const scale = (a: Point3, s: number): Point3 => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Point3, b: Point3): Point3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const unit = (a: Point3): Point3 => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / length, a[1] / length, a[2] / length]
}
export const vec = { sub, add, scale, dot, cross, unit }

export function viewerOf(P: Projection): Point3 {
  const { sinA, cosA, sinE, cosE } = cameraOf(P)
  return [cosA * cosE, sinA * cosE, sinE]
}

/** The kit lights side faces from the floor direction (−sin a, cos a); tops are lightest. */
export function lightOf(P: Projection): Point3 {
  const { sinA, cosA } = cameraOf(P)
  return unit([-sinA * 0.62, cosA * 0.62, 0.78])
}

const tenth = (value: number) => Math.round(value * 10) / 10
const pathOf = (points: Flat[], closed = true) =>
  points
    .map(([x, y], index) => `${index ? 'L' : 'M'}${tenth(x)} ${tenth(y)}`)
    .join('') + (closed ? 'Z' : '')

export const LEVELS = 13

/** Shade levels from the darkest side tone to the top tone. */
export function toneOf(normal: Point3, light: Point3): string {
  const lit = (dot(normal, light) + 1) / 2
  const t = Math.min(1, Math.max(0, (lit - 0.2) / 0.75))
  return String(Math.round(Math.pow(t, 1.15) * (LEVELS - 1)))
}

/**
 * Samples a parametric surface into facets and returns depth-sorted items:
 * tone-bucketed seamless facets plus silhouette and rim lines that end on
 * the body's own outline.
 */
export function surfaceItems(
  param: Param,
  P: Projection,
  style: SurfaceStyle,
): Item[] {
  const { rows, columns } = style
  const viewer = viewerOf(P)
  const light = lightOf(P)
  const cols = style.wrap ? columns : columns + 1
  const grid: Point3[][] = []
  for (let row = 0; row <= rows; row++) {
    const line: Point3[] = []
    for (let column = 0; column < cols; column++)
      line.push(param(row / rows, column / columns))
    grid.push(line)
  }
  const at = (row: number, column: number) => grid[row]![column % cols]!
  const screen = grid.map((line) => line.map((point) => iso(point, P)))
  const flat = (row: number, column: number) => screen[row]![column % cols]!
  const items: Item[] = []
  const facing: number[][] = []
  const depthAt: number[][] = []
  const hidden: boolean[][] = []
  const rims: { from: Flat; to: Flat; depth: number }[] = []
  const bias = style.bias ?? 0
  const attrs =
    (style.lit ? ' data-lit=""' : '') +
    (style.soft ? ' data-soft=""' : '') +
    (style.part ? ` data-part="${style.part}"` : '')

  for (let row = 0; row < rows; row++) {
    facing.push([])
    depthAt.push([])
    hidden.push([])
    for (let column = 0; column < columns; column++) {
      const a = at(row, column)
      const b = at(row + 1, column)
      const c = at(row + 1, column + 1)
      const d = at(row, column + 1)
      const middle = scale(add(add(a, b), add(c, d)), 0.25)
      let normal = unit(cross(sub(c, a), sub(d, b)))
      if (style.center && dot(normal, sub(middle, style.center)) < 0)
        normal = scale(normal, -1)
      if (
        style.spine &&
        dot(normal, sub(middle, style.spine((row + 0.5) / rows))) < 0
      )
        normal = scale(normal, -1)
      if (style.inward) normal = scale(normal, -1)
      const towards = dot(normal, viewer)
      const depth = depthOf(middle, P) + bias
      facing[row]!.push(towards)
      depthAt[row]!.push(depth)
      const gone = style.hide ? style.hide(middle) : false
      hidden[row]!.push(gone)
      if (gone) continue
      if (towards <= 0 && !style.doubleSided) continue
      const inner = towards <= 0
      const tone = style.recess
        ? `r${Math.min(2, Number(toneOf(inner ? scale(normal, -1) : normal, light)) >> 2)}`
        : inner
          ? String(Math.max(0, Number(toneOf(scale(normal, -1), light)) - 3))
          : toneOf(normal, light)
      let quad = [
        flat(row, column),
        flat(row + 1, column),
        flat(row + 1, column + 1),
        flat(row, column + 1),
      ]
      if (style.clip) {
        const corners = [a, b, c, d]
        const outside = corners.filter((p) => beyond(style.clip!, p) > 0).length
        if (outside === 4) {
          hidden[row]![column] = true
          continue
        }
        if (outside) {
          const kept = clipPolygon(corners, style.clip)
          quad = kept.map((p) => iso(p, P))
          for (let i = 0; i < kept.length; i++) {
            const p = kept[i]!
            const q = kept[(i + 1) % kept.length]!
            if (
              Math.abs(beyond(style.clip, p)) < 1e-6 &&
              Math.abs(beyond(style.clip, q)) < 1e-6
            )
              rims.push({ from: iso(p, P), to: iso(q, P), depth })
          }
        }
      }
      items.push({
        depth,
        key: `<path class="an-q" data-shade="${tone}"${attrs} d="`,
        d: pathOf(quad),
      })
    }
  }

  const edgeTone = style.edge ?? 'hi'
  if (edgeTone === 'none') return items
  const lineAttrs = `class="iso-line an-edge" data-tone="${style.lit ? 'lit' : edgeTone}"${style.part ? ` data-part="${style.part}"` : ''}`
  const edgeKey = `<path ${lineAttrs} d="`
  const edge = (from: Flat, to: Flat, depth: number) =>
    items.push({
      depth: depth + 0.01,
      key: edgeKey,
      d: pathOf([from, to], false),
    })
  for (const rim of rims) edge(rim.from, rim.to, rim.depth)
  const edge3 = (from: Point3, to: Point3, depth: number) => {
    const kept = style.clip ? clipSegment(from, to, style.clip) : [from, to]
    if (kept) edge(iso(kept[0], P), iso(kept[1], P), depth)
  }
  const visible = (row: number, column: number) =>
    !hidden[row]![column]! && (style.doubleSided || facing[row]![column]! > 0)
  const cutRim = (
    row: number,
    column: number,
    otherRow: number,
    otherColumn: number,
    from: Point3,
    to: Point3,
  ) => {
    const a = hidden[row]![column]!
    const b = hidden[otherRow]![otherColumn]!
    if (a === b) return false
    if (visible(a ? otherRow : row, a ? otherColumn : column))
      edge3(from, to, depthAt[a ? otherRow : row]![a ? otherColumn : column]!)
    return true
  }

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const here = facing[row]![column]! > 0
      const nextColumn = style.wrap ? (column + 1) % columns : column + 1
      if (nextColumn < columns) {
        const there = facing[row]![nextColumn]! > 0
        const cut = cutRim(
          row,
          column,
          row,
          nextColumn,
          at(row, column + 1),
          at(row + 1, column + 1),
        )
        if (
          !cut &&
          !hidden[row]![column]! &&
          here !== there &&
          !style.doubleSided
        )
          edge3(
            at(row, column + 1),
            at(row + 1, column + 1),
            Math.max(depthAt[row]![column]!, depthAt[row]![nextColumn]!),
          )
      }
      if (row + 1 < rows) {
        const there = facing[row + 1]![column]! > 0
        const cut = cutRim(
          row,
          column,
          row + 1,
          column,
          at(row + 1, column),
          at(row + 1, column + 1),
        )
        if (
          !cut &&
          !hidden[row]![column]! &&
          here !== there &&
          !style.doubleSided
        )
          edge3(
            at(row + 1, column),
            at(row + 1, column + 1),
            Math.max(depthAt[row]![column]!, depthAt[row + 1]![column]!),
          )
      }
    }
  }
  if (style.rims !== false) {
    for (let column = 0; column < columns; column++) {
      if (visible(0, column))
        edge3(at(0, column), at(0, column + 1), depthAt[0]![column]!)
      if (visible(rows - 1, column))
        edge3(
          at(rows, column),
          at(rows, column + 1),
          depthAt[rows - 1]![column]!,
        )
    }
    if (!style.wrap) {
      for (let row = 0; row < rows; row++) {
        if (visible(row, 0))
          edge3(at(row, 0), at(row + 1, 0), depthAt[row]![0]!)
        if (visible(row, columns - 1))
          edge3(
            at(row, columns),
            at(row + 1, columns),
            depthAt[row]![columns - 1]!,
          )
      }
    }
  }
  return items
}

/** Local frame of a surface, for marks and spots laid onto it. */
export function frameAt(param: Param, u: number, v: number) {
  const e = 1e-3
  const origin = param(u, v)
  const du = unit(
    sub(param(Math.min(1, u + e), v), param(Math.max(0, u - e), v)),
  )
  const dv = unit(
    sub(param(u, Math.min(1, v + e)), param(u, Math.max(0, v - e))),
  )
  return { origin, du, dv, normal: unit(cross(du, dv)) }
}

/** A small ellipse painted on a surface, visible only where the surface faces you. */
export function markItem(
  param: Param,
  P: Projection,
  u: number,
  v: number,
  size: [number, number],
  angle: number,
  {
    center,
    className = 'an-spot',
    opacity = 1,
    lift = 0.15,
  }: {
    center?: Point3
    className?: string
    opacity?: number
    lift?: number
  } = {},
): Item | null {
  const { origin, du, dv, normal: raw } = frameAt(param, u, v)
  const normal =
    center && dot(raw, sub(origin, center)) < 0 ? scale(raw, -1) : raw
  const towards = dot(normal, viewerOf(P))
  if (towards < 0.12) return null
  const points: Flat[] = []
  for (let step = 0; step < 10; step++) {
    const t = (step / 10) * Math.PI * 2
    const x = Math.cos(t) * size[0]
    const y = Math.sin(t) * size[1]
    const along = Math.cos(angle) * x - Math.sin(angle) * y
    const across = Math.sin(angle) * x + Math.cos(angle) * y
    points.push(
      iso(
        add(
          add(origin, scale(normal, lift)),
          add(scale(du, along), scale(dv, across)),
        ),
        P,
      ),
    )
  }
  const fade = Math.round(Math.min(1, (towards - 0.12) / 0.3) * opacity * 5) / 5
  if (fade <= 0) return null
  return {
    depth: depthOf(origin, P) + 0.02,
    key: `<path class="${className}" opacity="${fade}" d="`,
    d: pathOf(points),
  }
}

export function paint(items: Item[]): string {
  items.sort((a, b) => a.depth - b.depth)
  const out: string[] = []
  let key: string | undefined
  let run = ''
  const flush = () => {
    if (key) out.push(`${key}${run}"/>`)
    key = undefined
    run = ''
  }
  for (const item of items) {
    if (item.key) {
      if (item.key !== key) flush()
      key = item.key
      run += item.d
    } else {
      flush()
      out.push(item.svg ?? '')
    }
  }
  flush()
  return out.join('')
}

/**
 * Collapses a layer whose facets cannot overlap each other (a convex body seen
 * in orthographic projection) into one path per tone, painted at `depth`.
 */
export function layer(items: Item[], depth: number): Item[] {
  const runs = new Map<string, string>()
  const loose: Item[] = []
  for (const item of items) {
    if (!item.key) {
      loose.push(item)
      continue
    }
    runs.set(item.key, (runs.get(item.key) ?? '') + item.d)
  }
  const fills = [...runs].filter(([key]) => key.includes('an-q'))
  const lines = [...runs].filter(([key]) => !key.includes('an-q'))
  return [
    ...fills.map(([key, d]) => ({ depth, svg: `${key}${d}"/>` })),
    ...loose.map((item) => ({ ...item, depth: depth + 0.0005 })),
    ...lines.map(([key, d]) => ({
      depth: depth + 0.001,
      svg: `${key}${d}"/>`,
    })),
  ]
}

export type Transform = (point: Point3) => Point3

/** Model space (x along the shell, y dorsal up, z across) into the kit's world (z up). */
export function placeShell(
  at: Point3,
  size: number,
  { ventral = false, yaw = 0 }: { ventral?: boolean; yaw?: number } = {},
): Transform {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return ([x, y, z]) => {
    const up = ventral ? -y : y
    const across = ventral ? -z : z
    const wx = x * size
    const wy = across * size
    return [
      at[0] + wx * cos - wy * sin,
      at[1] + wx * sin + wy * cos,
      at[2] + up * size,
    ]
  }
}

/** An ellipsoid with radii along x, y and z, optionally turned about z. */
export function ellipsoid(
  center: Point3,
  radii: Point3,
  yaw = 0,
  pitch = 0,
): Param {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  return (u, v) => {
    const a = Math.PI * u
    const b = Math.PI * 2 * v
    const x = Math.sin(a) * Math.cos(b) * radii[0]
    const y = Math.sin(a) * Math.sin(b) * radii[1]
    const z = Math.cos(a) * radii[2]
    const px = x * cp - z * sp
    const pz = x * sp + z * cp
    return [
      center[0] + px * cy - y * sy,
      center[1] + px * sy + y * cy,
      center[2] + pz,
    ]
  }
}

/** A tube of varying radius along a curve given in world space. */
export function tubeAlong(
  curve: (t: number) => Point3,
  radius: (t: number) => number,
  up: Point3 = [0, 0, 1],
): Param {
  return (u, v) => {
    const t = Math.min(0.999, Math.max(0.001, u))
    const here = curve(t)
    const tangent = unit(sub(curve(t + 0.001), curve(t - 0.001)))
    let side = cross(tangent, up)
    if (Math.hypot(side[0], side[1], side[2]) < 1e-3)
      side = cross(tangent, [1, 0, 0])
    side = unit(side)
    const normal = cross(side, tangent)
    const angle = v * Math.PI * 2
    const r = radius(t)
    return add(
      here,
      add(scale(side, Math.cos(angle) * r), scale(normal, Math.sin(angle) * r)),
    )
  }
}

/** A quadratic Bezier, the usual shape for a tentacle, siphon or duct. */
export const bend =
  (a: Point3, control: Point3, b: Point3) =>
  (t: number): Point3 => {
    const s = 1 - t
    return [
      s * s * a[0] + 2 * s * t * control[0] + t * t * b[0],
      s * s * a[1] + 2 * s * t * control[1] + t * t * b[1],
      s * s * a[2] + 2 * s * t * control[2] + t * t * b[2],
    ]
  }
