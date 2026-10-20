import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Rgb } from './patterns.ts'

/**
 * Small tools for building scenery fast: every piece is painted with vertex
 * colours and a sway weight, then merged with the rest of its kind into one
 * mesh, so a whole reef costs a handful of draw calls instead of hundreds.
 */

/** Value noise in 3D, smooth and cheap; about −1 to 1. */
export function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = x - xi
  const yf = y - yi
  const zf = z - zi
  const s = (t: number) => t * t * (3 - 2 * t)
  const u = s(xf)
  const v = s(yf)
  const w = s(zf)
  const h = (a: number, b: number, c: number) => {
    const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453
    return (n - Math.floor(n)) * 2 - 1
  }
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  return lerp(
    lerp(
      lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u),
      lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u),
      v,
    ),
    lerp(
      lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u),
      lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u),
      v,
    ),
    w,
  )
}

/** Layered noise: broad shapes with finer detail on top. */
export function fbm(x: number, y: number, z: number, octaves = 3) {
  let sum = 0
  let amp = 0.5
  let f = 1
  for (let i = 0; i < octaves; i++) {
    sum += noise3(x * f, y * f, z * f) * amp
    f *= 2.03
    amp *= 0.5
  }
  return sum
}

export const linear = ([r, g, b]: Rgb, out = new Color()) =>
  out.setRGB(r / 255, g / 255, b / 255)

export type Painter = (p: Vector3, n: Vector3, out: Color) => void

/**
 * Gives a geometry vertex colours and sway, in its own frame (base at the
 * origin, up is +y), ready to be placed and merged. `sway` is how far each
 * point moves with the water, in world units; `phase` sets it apart from its
 * neighbours.
 */
export function paint(
  geometry: BufferGeometry,
  colour: Painter | Rgb,
  sway: ((p: Vector3) => number) | number = 0,
  phase = 0,
) {
  if (geometry.index === null)
    throw new Error('Scenery pieces must be indexed geometry.')
  geometry.deleteAttribute('uv')
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const colours = new Float32Array(position.count * 3)
  const swayed = new Float32Array(position.count * 2)
  const p = new Vector3()
  const n = new Vector3()
  const c = new Color()
  const flat = Array.isArray(colour) ? linear(colour as Rgb) : null
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i)
    n.fromBufferAttribute(normal, i)
    if (flat) c.copy(flat)
    else (colour as Painter)(p, n, c)
    colours[i * 3] = c.r
    colours[i * 3 + 1] = c.g
    colours[i * 3 + 2] = c.b
    swayed[i * 2] = typeof sway === 'number' ? sway : sway(p)
    swayed[i * 2 + 1] = phase
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
  geometry.setAttribute('aSway', new Float32BufferAttribute(swayed, 2))
  return geometry
}

const placeMatrix = new Matrix4()
const placeQuat = new Quaternion()
const placeScale = new Vector3()
/** Moves a painted piece to its spot: position, turn about y, and lean. */
export function place(
  geometry: BufferGeometry,
  at: Vector3,
  yaw = 0,
  lean: Quaternion | null = null,
  scale = 1,
) {
  placeQuat.setFromAxisAngle(new Vector3(0, 1, 0), yaw)
  if (lean) placeQuat.premultiply(lean)
  placeMatrix.compose(at, placeQuat, placeScale.setScalar(scale))
  geometry.applyMatrix4(placeMatrix)
  return geometry
}

/** Collects painted pieces and merges them into one geometry. */
export class Batch {
  parts: BufferGeometry[] = []
  add(...geometries: BufferGeometry[]) {
    this.parts.push(...geometries)
  }
  get size() {
    return this.parts.length
  }
  merge() {
    if (!this.parts.length) return null
    const merged = mergeGeometries(this.parts, false)
    this.parts.forEach((part) => part.dispose())
    this.parts = []
    if (!merged) throw new Error('Scenery pieces could not be merged.')
    merged.computeBoundingSphere()
    return merged
  }
}

/** Mixes two colours, both sRGB 0–255 like the palettes. */
export const blendRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]
