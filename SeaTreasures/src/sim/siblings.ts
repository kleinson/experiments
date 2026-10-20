import {
  BufferGeometry,
  Camera,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Mesh,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { underwater } from './water.ts'
import { buildGastropodLarva } from './larvae.ts'
import type { Material } from 'three'

/**
 * Sibling veligers: larvae from the same brood or spawning drifting around the
 * one shown (claims in crawl.ts `hatchesTogether`). One instanced mesh, a dozen
 * copies at the larva's own size, so they cost a single draw call. Each bobs on
 * its beating velum, turns slowly as veligers do, and stays behind the larva
 * being looked at, smaller and hazier with distance as in a photograph.
 */

const tinted = (geometry: BufferGeometry, rgb: [number, number, number]) => {
  const colour = new Color().setRGB(...rgb).convertSRGBToLinear()
  const colours = new Float32Array(geometry.getAttribute('position').count * 3)
  for (let i = 0; i < colours.length; i += 3) {
    colours[i] = colour.r
    colours[i + 1] = colour.g
    colours[i + 2] = colour.b
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
  return geometry
}

/**
 * A veliger about one unit across, drawn like the larva shown: a small translucent
 * first whorl with a purple-red tinge, and above it the two thin velum lobes,
 * each edged with its band of cilia.
 */
function veligerGeometry() {
  const geometries: BufferGeometry[] = []
  const materials: Material[] = []
  const larva = buildGastropodLarva(1, {
    geometry<T extends BufferGeometry>(geometry: T) {
      geometries.push(geometry)
      return geometry
    },
    material<T extends Material>(material: T) {
      materials.push(material)
      return material
    },
  })
  larva.group.updateMatrixWorld(true)
  const parts: BufferGeometry[] = []
  larva.group.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld)
    geometry.deleteAttribute('uv')
    const material = object.material
    const color =
      material instanceof MeshStandardMaterial
        ? material.color.clone().convertLinearToSRGB()
        : new Color(0xe0d8ce)
    parts.push(tinted(geometry, [color.r, color.g, color.b]))
  })
  const merged = mergeGeometries(parts, false)
  for (const part of parts) part.dispose()
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  if (!merged) throw new Error('Veliger pieces could not be merged.')
  return merged
}

type Sibling = {
  home: Vector3
  scale: number
  phase: number
  spin: number
  tilt: number
}

export type Siblings = {
  group: Group
  animate: (t: number, camera: Camera, centre: Vector3) => void
  dispose: () => void
}

/**
 * Siblings for a larva `size` long (scene units), spread through a cloud
 * about `spread` across around `centre`. The count is kept low for frame rate.
 */
export function buildSiblings(
  size: number,
  spread: number,
  centre: Vector3,
  random: () => number,
  count = 6,
): Siblings {
  const geometry = veligerGeometry()
  const material = underwater(
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.35,
      metalness: 0,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      side: DoubleSide,
    }),
  )
  const mesh = new InstancedMesh(geometry, material, count)
  mesh.frustumCulled = false
  mesh.castShadow = false
  mesh.userData.noInk = true
  mesh.raycast = () => {}
  const group = new Group()
  group.name = 'sibling-larvae'
  group.add(mesh)

  const between = (a: number, b: number) => a + (b - a) * random()
  const siblings: Sibling[] = []
  for (let i = 0; i < count; i++) {
    // Not too close to the larva being shown, so it stays easy to read and tap.
    const home = new Vector3()
    do {
      home.set(between(-1, 1), between(-0.7, 0.7), between(-1, 1))
    } while (home.length() > 1 || home.length() < 0.35)
    home.multiplyScalar(spread * 0.5).add(centre)
    siblings.push({
      home,
      // Siblings are the same size (newly hatched tiger cowrie veligers are 200–240 µm), but
      // they drift 1.5 to 3 times farther from the lens, so a photo would show them smaller.
      scale: (size * between(0.92, 1.05)) / between(2.5, 4),
      phase: random() * 100,
      spin: between(0.08, 0.2) * (random() < 0.5 ? -1 : 1),
      tilt: between(-0.35, 0.35),
    })
    // Farther siblings fade into the blue, so the cloud reads as deep though the camera is flat.
    const far = 0.3 + random() * 0.5
    mesh.setColorAt(i, new Color(1 - far * 0.55, 1 - far * 0.3, 1 - far * 0.12))
  }

  const matrix = new Matrix4()
  const q = new Quaternion()
  const lean = new Quaternion()
  const scaleV = new Vector3()
  const at = new Vector3()
  const toCamera = new Vector3()
  const off = new Vector3()
  const yAxis = new Vector3(0, 1, 0)
  const zAxis = new Vector3(0, 0, 1)
  const animate = (t: number, camera: Camera, centre: Vector3) => {
    camera.getWorldDirection(toCamera).negate()
    for (let i = 0; i < count; i++) {
      const s = siblings[i]!
      const p = s.phase
      at.copy(s.home)
      at.x += Math.sin(t * 0.21 + p) * size * 0.8
      at.z += Math.sin(t * 0.17 + p * 1.3) * size * 0.8
      at.y +=
        Math.sin(t * 0.35 + p) * size * 0.04 +
        Math.sin(t * 0.09 + p) * size * 0.15
      // Always behind the larva being shown, as seen from the camera, never in front of it.
      off.copy(at).sub(centre)
      const along = off.dot(toCamera)
      if (along > -size)
        at.addScaledVector(toCamera, -along - size * (1 + i * 0.1))
      q.setFromAxisAngle(yAxis, t * s.spin + p)
      lean.setFromAxisAngle(zAxis, s.tilt + Math.sin(t * 0.5 + p) * 0.12)
      q.premultiply(lean)
      matrix.compose(at, q, scaleV.setScalar(s.scale))
      mesh.setMatrixAt(i, matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }
  animate(0, new Camera(), centre)

  return {
    group,
    animate,
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
