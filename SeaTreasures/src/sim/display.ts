import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
} from 'three'
import type { Scenery } from './seafloor.ts'

const wood = new Color(0.19, 0.075, 0.03)
const woodEdge = new Color(0.34, 0.15, 0.055)
const backing = new Color(0.075, 0.045, 0.03)

/**
 * A quiet, dry display case for the final "found" chapter. Dimensions are in
 * millimetres so the shell remains the object being measured, not the room.
 */
export function buildDisplayCase(extent: number): Scenery {
  const group = new Group()
  group.name = 'found-display-case'
  const width = Math.max(1100, extent * 3.6)
  const height = Math.max(850, extent * 2.8)
  const depth = Math.max(360, extent * 1.1)
  const bar = Math.max(42, extent * 0.12)
  const shelf = Math.max(260, extent * 0.9)
  const materials = [
    new MeshStandardMaterial({ color: wood, roughness: 0.72 }),
    new MeshStandardMaterial({ color: woodEdge, roughness: 0.62 }),
    new MeshStandardMaterial({ color: backing, roughness: 0.9 }),
    new MeshPhysicalMaterial({
      color: new Color(0.78, 0.9, 0.92),
      roughness: 0.08,
      transmission: 0.72,
      transparent: true,
      opacity: 0.2,
      thickness: 2,
      depthWrite: false,
    }),
  ]
  const add = (
    geometry: BoxGeometry | PlaneGeometry,
    material: MeshStandardMaterial | MeshPhysicalMaterial,
    position: Vector3,
  ) => {
    const mesh = new Mesh(geometry, material)
    mesh.position.copy(position)
    group.add(mesh)
    return mesh
  }
  const box = (x: number, y: number, z: number) => new BoxGeometry(x, y, z)

  add(
    box(width, height, bar),
    materials[2]!,
    new Vector3(0, height / 2, -depth / 2),
  )
  add(box(width + bar * 2, bar, depth), materials[1]!, new Vector3(0, 0, 0))
  add(
    box(width + bar * 2, bar, depth),
    materials[1]!,
    new Vector3(0, height, 0),
  )
  add(
    box(bar, height, depth),
    materials[1]!,
    new Vector3(-width / 2, height / 2, 0),
  )
  add(
    box(bar, height, depth),
    materials[1]!,
    new Vector3(width / 2, height / 2, 0),
  )
  add(
    box(width - bar * 1.5, bar * 0.8, depth * 0.9),
    materials[1]!,
    new Vector3(0, shelf, 0),
  )
  add(
    box(width - bar * 1.5, bar * 0.8, depth * 0.9),
    materials[1]!,
    new Vector3(0, shelf * 2, 0),
  )
  for (const x of [-width * 0.27, width * 0.27]) {
    add(
      box(bar * 0.72, height - bar * 2, depth * 0.86),
      materials[1]!,
      new Vector3(x, height / 2, 0),
    )
  }
  add(
    new PlaneGeometry(width - bar * 2, height - bar * 2),
    materials[3]!,
    new Vector3(0, height / 2, depth / 2),
  ).rotation.y = Math.PI

  const plinth = add(
    box(width * 0.26, bar * 0.55, depth * 0.42),
    materials[1]!,
    new Vector3(0, bar * 0.75, 20),
  )
  plinth.userData.displayPlinth = true
  group.position.y = -height * 0.3

  return {
    group,
    ground: false,
    animated: false,
    sway: () => undefined,
    feed: [],
    sand: [],
    homes: [],
    dispose: () => {
      group.traverse((object) => {
        if (!(object instanceof Mesh)) return
        object.geometry.dispose()
        if (Array.isArray(object.material))
          object.material.forEach((material) => material.dispose())
        else object.material.dispose()
      })
    },
  }
}
