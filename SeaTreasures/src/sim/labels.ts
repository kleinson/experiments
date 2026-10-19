import { Object3D, Vector3 } from 'three'
import type { Mesh } from 'three'

/**
 * A named point for the figure's labels. It carries no geometry, so it never
 * changes a bounding box. `inside` labels show only when the shell is cut or
 * seen through.
 */
export function marker(text: string, at: Vector3, inside = false) {
  const point = new Object3D()
  point.position.copy(at)
  point.userData.label = text
  point.userData.inside = inside
  return point
}

/** Labels the middle of a mesh's own geometry. */
export function markMesh(mesh: Mesh, text: string, inside = false) {
  mesh.geometry.computeBoundingBox()
  const centre = mesh.geometry.boundingBox!.getCenter(new Vector3())
  mesh.add(marker(text, centre, inside))
  return mesh
}

export type Label = { text: string; anchor: Object3D; inside: boolean }

/** Every distinct label under `root`, the first of each name. */
export function labelsIn(root: Object3D) {
  const found = new Map<string, Label>()
  root.traverse((object) => {
    const text = object.userData.label as string | undefined
    if (!text || found.has(text)) return
    found.set(text, {
      text,
      anchor: object,
      inside: Boolean(object.userData.inside),
    })
  })
  return [...found.values()]
}
