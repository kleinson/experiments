import { BufferGeometry, CircleGeometry, Float32BufferAttribute } from 'three'
import { adultAngle, coilPoint, growthRate } from './coil.ts'
import type { Coil, Point3 } from './coil.ts'

const TAU = Math.PI * 2

/** Coil units → three.js space (y up), scaled to millimetres. */
export const toThree = ([x, y, z]: Point3, scale: number) =>
  [x * scale, z * scale, -y * scale] as const

/**
 * Where along the growth record a coil angle sits: the fraction of the adult
 * shell's size. Along a logarithmic spiral the length of edge laid down grows
 * with size, so this keeps pattern spacing even on old and new whorls.
 */
export const growthU = (coil: Coil, theta: number) =>
  Math.exp(growthRate(coil) * (theta - adultAngle(coil)))

/**
 * The shell surface built so far, from the protoconch to `end` radians.
 * UVs pin each part of the surface to the moment it was made: u is the
 * growth record (see growthU), v goes around the aperture.
 */
export function coilGeometry(
  coil: Coil,
  scale: number,
  end: number,
  {
    inset = 0,
    flare = 0,
    detail = 1,
    start = 0.04,
  }: { inset?: number; flare?: number; detail?: number; start?: number } = {},
) {
  const rows = Math.max(24, Math.round(((end - start) / TAU) * 64 * detail))
  const columns = Math.round(48 * detail)
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let row = 0; row <= rows; row++) {
    const theta = start + ((end - start) * row) / rows
    for (let column = 0; column <= columns; column++) {
      const s = (column / columns) * TAU
      const point = toThree(coilPoint(coil, theta, s, { inset, flare }), scale)
      positions.push(point[0], point[1], point[2])
      uvs.push(growthU(coil, theta), column / columns)
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column
        const b = a + columns + 1
        if (inset > 0) indices.push(a, a + 1, b, b, a + 1, b + 1)
        else indices.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

/** The lip that joins the outer and inner surfaces at the aperture. */
export function lipGeometry(
  coil: Coil,
  scale: number,
  end: number,
  inset: number,
  flare = 0,
) {
  const columns = 64
  const positions: number[] = []
  const indices: number[] = []
  for (let column = 0; column <= columns; column++) {
    const s = (column / columns) * TAU
    for (const depth of [0, inset]) {
      const point = toThree(
        coilPoint(coil, end, s, { inset: depth, flare }),
        scale,
      )
      positions.push(point[0], point[1], point[2])
    }
    if (column < columns) {
      const a = column * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** A chamber wall: the aperture outline at `theta`, filled. */
export function septumGeometry(
  coil: Coil,
  scale: number,
  theta: number,
  inset: number,
) {
  const segments = 48
  const circle = new CircleGeometry(1, segments)
  const position = circle.getAttribute('position')
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index)
    const y = position.getY(index)
    const r = Math.hypot(x, y)
    const s = Math.atan2(y, x)
    const edge = coilPoint(coil, theta, s, { inset })
    const middle = coilPoint(coil, theta, 0, { inset: 1 })
    const point = toThree(
      [
        middle[0] + (edge[0] - middle[0]) * r,
        middle[1] + (edge[1] - middle[1]) * r,
        middle[2] + (edge[2] - middle[2]) * r,
      ],
      scale,
    )
    position.setXYZ(index, point[0], point[1], point[2])
  }
  circle.computeVertexNormals()
  return circle
}
