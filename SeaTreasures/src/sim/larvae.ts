import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  DoubleSide,
  SphereGeometry,
  Vector3,
} from 'three'
import type { Material } from 'three'
import { markMesh } from './labels.ts'
import { buildVelum } from './velum.ts'

type Own = {
  geometry<T extends BufferGeometry>(value: T): T
  material<T extends Material>(value: T): T
}

/** An open, growing protoconch, not the adult's polished cowrie shell. Unit width. */
export function protoconchGeometry(detail = 64, maturity = 0): BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const sides = 16
  for (let i = 0; i <= detail; i++) {
    const t = i / detail
    const a = (t - 1) * Math.PI * 2 * (0.85 + maturity * 0.4)
    const r = 0.055 * Math.exp(t * 1.72)
    const tube = r * 0.95
    for (let j = 0; j <= sides; j++) {
      const b = (j / sides) * Math.PI * 2
      positions.push(
        ((r + tube * Math.cos(b)) * Math.cos(a) - 0.3) * 1.8,
        ((r + tube * Math.cos(b)) * Math.sin(a) - 0.14) * 1.8,
        tube * Math.sin(b) * 1.8,
      )
      if (i < detail && j < sides) {
        const k = i * (sides + 1) + j
        indices.push(
          k,
          k + sides + 1,
          k + 1,
          k + 1,
          k + sides + 1,
          k + sides + 2,
        )
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  geometry.scale(
    1 / (box.max.x - box.min.x),
    1 / (box.max.x - box.min.x),
    1 / (box.max.x - box.min.x),
  )
  geometry.computeVertexNormals()
  return geometry
}

/** Newly hatched cowrie sizes are 200–240 µm (Tay et al. 2023). Others illustrative. */
export function larvalSize(speciesId: string, local: number): number {
  const hatch = speciesId === 'giant-clam' ? 0.16 : 0.22
  return hatch * (1 + Math.min(1, Math.max(0, local)) * 0.35)
}

export function buildGastropodLarva(size: number, own: Own, maturity = 0) {
  const group = new Group()
  const shellMaterial = own.material(
    new MeshPhysicalMaterial({
      color: 0xe3d9c8,
      roughness: 0.32,
      transparent: true,
      opacity: 0.55,
      side: DoubleSide,
      depthWrite: false,
    }),
  )
  shellMaterial.userData.reflect = 0.08
  const shell = new Mesh(
    own.geometry(protoconchGeometry(64, maturity)),
    shellMaterial,
  )
  shell.scale.setScalar(size)
  markMesh(shell, 'Larval shell')
  group.add(shell)
  const flesh = own.material(
    new MeshPhysicalMaterial({
      color: 0x725060,
      transparent: true,
      opacity: 0.78,
      roughness: 0.65,
      depthWrite: false,
    }),
  )
  const ball = own.geometry(new SphereGeometry(1, 18, 12))
  const gut = new Mesh(ball, flesh)
  gut.scale.set(size * 0.22, size * 0.2, size * 0.14)
  gut.position.set(-size * 0.29, -size * 0.22, 0)
  const foot = new Mesh(ball, flesh)
  foot.scale.set(size * 0.1, size * 0.2, size * 0.07)
  foot.position.set(size * 0.12, -size * 0.15, size * 0.08)
  foot.rotation.z = -0.5
  markMesh(foot, 'Larval foot')
  group.add(gut, foot)
  const dark = own.material(new MeshStandardMaterial({ color: 0x332d30 }))
  for (const side of [-1, 1]) {
    const eye = new Mesh(ball, dark)
    eye.scale.setScalar(size * 0.025)
    eye.position.set(side * size * 0.09, -size * 0.025, size * 0.09)
    group.add(eye)
  }
  const velum = buildVelum(size, own, maturity)
  group.add(velum.group)
  return { group, velum, centre: new Vector3(-size * 0.18, -size * 0.2, 0) }
}
