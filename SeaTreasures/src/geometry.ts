import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  TubeGeometry,
  Vector3,
} from 'three'
import { bounded, getShape } from './model.ts'
import { shellPoint } from './shellform.ts'

export { makeSpots, shellPoint } from './shellform.ts'

export const shellSegments = { length: 72, circumference: 64 }

export function createShellGeometry(
  progress: number,
  region: 'shell' | 'inner' | 'mantle-left' | 'mantle-right' = 'shell',
  coverage = 0,
) {
  const shape = getShape(progress)
  const mantle = region === 'mantle-left' || region === 'mantle-right'
  const fraction = bounded(coverage, 0, 100) / 100
  const minTheta =
    region === 'mantle-right'
      ? (Math.PI - shape.opening) * (1 - fraction)
      : -Math.PI + shape.opening
  const maxTheta =
    region === 'mantle-left'
      ? -Math.PI + shape.opening + fraction * (Math.PI - shape.opening)
      : Math.PI - shape.opening
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const rows = shellSegments.length
  const columns = shellSegments.circumference

  for (let row = 0; row <= rows; row++) {
    const u = row / rows
    for (let column = 0; column <= columns; column++) {
      const v = column / columns
      const theta = minTheta + (maxTheta - minTheta) * v
      const point = shellPoint(
        u,
        theta,
        progress,
        region === 'inner' ? 0.035 : mantle ? -0.018 : 0,
      )
      positions.push(point.x, point.y, point.z)
      uvs.push(u, v)
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column
        const b = a + columns + 1
        indices.push(a, b, a + 1, b, b + 1, a + 1)
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

export function createSpireGeometry() {
  const points = Array.from({ length: 100 }, (_, index) => {
    const t = index / 99
    const angle = t * Math.PI * 3.5
    const radius = 0.04 + t * 0.34
    return new Vector3(
      1.88 - t * 0.28,
      Math.cos(angle) * radius * 0.82,
      Math.sin(angle) * radius,
    )
  })
  return new TubeGeometry(new CatmullRomCurve3(points), 110, 0.045, 8, false)
}
