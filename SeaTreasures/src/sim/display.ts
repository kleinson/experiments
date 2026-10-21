import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import type { BufferGeometry, Material } from 'three'
import type { Scenery } from './seafloor.ts'

const wood = new Color(0.25, 0.095, 0.03)
const woodEdge = new Color(0.46, 0.22, 0.075)
const woodLight = new Color(0.62, 0.34, 0.13)
const backing = new Color(0.07, 0.035, 0.02)
const felt = new Color(0.055, 0.08, 0.07)

/**
 * A letterpress-style museum drawer for the final "found" chapter. The centre
 * bay is kept clear for the selected shell; the surrounding cubbies show the
 * breadth and variation of a real collection.
 */
export function buildDisplayCase(extent: number): Scenery {
  const group = new Group()
  group.name = 'found-display-case'
  const width = Math.max(1200, extent * 4)
  const height = Math.max(900, extent * 3)
  const depth = Math.max(360, extent * 1.1)
  const bar = Math.max(38, extent * 0.105)
  const cols = 9
  const rows = 5
  const innerWidth = width - bar * 2.8
  const innerHeight = height - bar * 2.8
  const cellWidth = innerWidth / cols
  const cellHeight = innerHeight / rows
  const selectedRow = Math.max(
    0,
    Math.min(rows - 1, Math.floor((height * 0.3 - bar * 1.4) / cellHeight)),
  )
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()

  const material = <T extends Material>(value: T) => {
    materials.add(value)
    return value
  }
  const geometry = <T extends BufferGeometry>(value: T) => {
    geometries.add(value)
    return value
  }
  const woodFace = material(
    new MeshStandardMaterial({ color: wood, roughness: 0.76 }),
  )
  const woodTrim = material(
    new MeshStandardMaterial({ color: woodEdge, roughness: 0.64 }),
  )
  const woodHighlight = material(
    new MeshStandardMaterial({ color: woodLight, roughness: 0.62 }),
  )
  const darkBack = material(
    new MeshStandardMaterial({ color: backing, roughness: 0.92 }),
  )
  const darkFelt = material(
    new MeshStandardMaterial({ color: felt, roughness: 1 }),
  )
  const labelPaper = material(
    new MeshStandardMaterial({
      color: new Color(0.88, 0.82, 0.66),
      roughness: 0.94,
    }),
  )
  const aperture = material(
    new MeshStandardMaterial({
      color: new Color(0.12, 0.065, 0.035),
      roughness: 0.72,
    }),
  )
  const brass = material(
    new MeshPhysicalMaterial({
      color: new Color(0.62, 0.42, 0.13),
      roughness: 0.32,
      metalness: 0.72,
    }),
  )
  const glass = material(
    new MeshPhysicalMaterial({
      color: new Color(0.78, 0.9, 0.92),
      roughness: 0.08,
      transmission: 0.76,
      transparent: true,
      opacity: 0.12,
      thickness: 2,
      depthWrite: false,
    }),
  )
  const shellColours = [
    [0.92, 0.83, 0.63],
    [0.76, 0.42, 0.2],
    [0.82, 0.7, 0.48],
    [0.68, 0.56, 0.38],
    [0.9, 0.88, 0.77],
    [0.48, 0.33, 0.24],
    [0.83, 0.55, 0.31],
    [0.64, 0.67, 0.58],
  ].map(([r, g, b]) =>
    material(
      new MeshPhysicalMaterial({
        color: new Color(r!, g!, b!),
        roughness: 0.46,
        clearcoat: 0.22,
      }),
    ),
  )

  const add = (
    shape: BufferGeometry,
    surface: Material,
    position = new Vector3(),
    parent: Group = group,
  ) => {
    const mesh = new Mesh(shape, surface)
    mesh.position.copy(position)
    parent.add(mesh)
    return mesh
  }
  const box = (x: number, y: number, z: number) =>
    geometry(new BoxGeometry(x, y, z))

  add(box(width, height, bar), darkBack, new Vector3(0, height / 2, -depth / 2))
  add(
    box(cellWidth * 3 - bar * 0.32, cellHeight - bar * 0.42, bar * 0.35),
    darkFelt,
    new Vector3(
      0,
      bar * 1.4 + cellHeight * (selectedRow + 0.5),
      -depth / 2 + bar * 0.72,
    ),
  )

  for (const [y, scale] of [
    [0, 1],
    [height, 1],
    [bar * 0.48, 0.58],
    [height - bar * 0.48, 0.58],
  ] as const)
    add(
      box(width + bar * 2.2, bar * scale, depth),
      scale === 1 ? woodTrim : woodHighlight,
      new Vector3(0, y, 0),
    )
  for (const [x, scale] of [
    [-width / 2, 1],
    [width / 2, 1],
    [-width / 2 + bar * 0.48, 0.58],
    [width / 2 - bar * 0.48, 0.58],
  ] as const)
    add(
      box(bar * scale, height, depth),
      scale === 1 ? woodTrim : woodHighlight,
      new Vector3(x, height / 2, 0),
    )

  for (let row = 0; row <= rows; row++) {
    const y = bar * 1.4 + cellHeight * row
    add(
      box(innerWidth, bar * 0.34, depth * 0.62),
      row === 0 || row === rows ? woodHighlight : woodFace,
      new Vector3(0, y, 0),
    )
  }
  for (let row = 0; row < rows; row++)
    for (let col = 1; col < cols; col++) {
      if (
        row === selectedRow &&
        (col === Math.floor(cols / 2) || col === Math.ceil(cols / 2))
      )
        continue
      add(
        box(bar * 0.3, cellHeight - bar * 0.24, depth * 0.58),
        woodFace,
        new Vector3(
          -innerWidth / 2 + cellWidth * col,
          bar * 1.4 + cellHeight * (row + 0.5),
          0,
        ),
      )
    }

  const sphere = geometry(new SphereGeometry(1, 18, 12))
  const spot = geometry(new SphereGeometry(1, 10, 7))
  const cone = geometry(new ConeGeometry(1, 2, 18))
  const disc = geometry(new CylinderGeometry(1, 1, 0.18, 20))
  const tusk = geometry(new TorusGeometry(0.7, 0.2, 10, 20, Math.PI * 1.35))
  const band = geometry(new TorusGeometry(0.55, 0.07, 8, 20))
  const slit = box(1.5, 0.09, 0.16)
  const addSpecimen = (index: number, x: number, y: number) => {
    const specimen = new Group()
    specimen.name = `collection-specimen-${index + 1}`
    specimen.position.set(x, y, depth * 0.27)
    specimen.rotation.z = ((index % 5) - 2) * 0.055
    const size = Math.min(cellWidth * 0.25, cellHeight * 0.22)
    const shell = shellColours[index % shellColours.length]!
    switch (index % 6) {
      case 0: {
        const body = add(sphere, shell, new Vector3(), specimen)
        body.scale.set(size * 1.18, size * 0.72, size * 0.58)
        const opening = add(
          slit,
          aperture,
          new Vector3(0, -size * 0.16, size * 0.58),
          specimen,
        )
        opening.scale.set(size * 0.76, size, size)
        for (const [atX, atY] of [
          [-0.62, 0.12],
          [-0.26, -0.28],
          [0.02, 0.26],
          [0.38, -0.12],
          [0.68, 0.22],
        ] as const) {
          const mark = add(
            spot,
            aperture,
            new Vector3(atX * size, atY * size, size * 0.59),
            specimen,
          )
          mark.scale.set(size * 0.105, size * 0.075, size * 0.035)
        }
        break
      }
      case 1: {
        const body = add(
          sphere,
          shell,
          new Vector3(0, -size * 0.18, 0),
          specimen,
        )
        body.scale.set(size * 0.78, size * 0.68, size * 0.55)
        const spire = add(cone, shell, new Vector3(0, size * 0.62, 0), specimen)
        spire.scale.set(size * 0.46, size * 0.72, size * 0.46)
        for (const atY of [0.22, 0.56, 0.88]) {
          const stripe = add(
            band,
            aperture,
            new Vector3(0, atY * size, size * 0.02),
            specimen,
          )
          stripe.rotation.x = Math.PI / 2
          stripe.scale.setScalar(size * (0.74 - atY * 0.34))
        }
        break
      }
      case 2: {
        const shellDisc = add(disc, shell, new Vector3(), specimen)
        shellDisc.rotation.x = Math.PI / 2
        shellDisc.scale.set(size, size * 0.42, size * 1.08)
        for (let rib = -2; rib <= 2; rib++) {
          const line = add(
            box(size * 0.08, size * 1.52, size * 0.08),
            aperture,
            new Vector3(rib * size * 0.27, 0, size * 0.22),
            specimen,
          )
          line.rotation.z = -rib * 0.12
        }
        break
      }
      case 3: {
        const tower = add(cone, shell, new Vector3(), specimen)
        tower.scale.set(size * 0.58, size * 1.05, size * 0.58)
        tower.rotation.z = Math.PI
        for (const atY of [-0.55, -0.12, 0.32]) {
          const stripe = add(
            band,
            aperture,
            new Vector3(0, atY * size, size * 0.02),
            specimen,
          )
          stripe.rotation.x = Math.PI / 2
          stripe.scale.setScalar(size * (0.56 - atY * 0.14))
        }
        break
      }
      case 4: {
        const curl = add(tusk, shell, new Vector3(), specimen)
        curl.rotation.z = Math.PI * 0.18
        curl.scale.set(size, size, size)
        const core = add(
          sphere,
          aperture,
          new Vector3(-size * 0.12, size * 0.08, 0),
          specimen,
        )
        core.scale.setScalar(size * 0.22)
        break
      }
      default: {
        const limpet = add(cone, shell, new Vector3(), specimen)
        limpet.scale.set(size, size * 0.48, size * 0.82)
        const rim = add(
          band,
          aperture,
          new Vector3(0, -size * 0.42, size * 0.03),
          specimen,
        )
        rim.scale.set(size * 1.38, size * 0.82, size)
        break
      }
    }
    group.add(specimen)
  }

  let specimenIndex = 0
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const inShowcase =
        row === selectedRow &&
        (col === Math.floor(cols / 2) - 1 ||
          col === Math.floor(cols / 2) ||
          col === Math.floor(cols / 2) + 1)
      if (inShowcase) continue
      const x = -innerWidth / 2 + cellWidth * (col + 0.5)
      const floor = bar * 1.4 + cellHeight * row + bar * 0.28
      const y = floor + cellHeight * (0.38 + (specimenIndex % 3) * 0.035)
      addSpecimen(specimenIndex++, x, y)
      if (specimenIndex % 4 === 0)
        add(
          box(cellWidth * 0.42, bar * 0.16, bar * 0.06),
          labelPaper,
          new Vector3(x, floor + bar * 0.24, depth * 0.19),
        )
    }

  const showcaseY = bar * 1.4 + cellHeight * selectedRow
  const plinth = add(
    box(cellWidth * 1.55, bar * 0.38, depth * 0.38),
    woodHighlight,
    new Vector3(0, showcaseY + bar * 0.22, depth * 0.03),
  )
  plinth.userData.displayPlinth = true
  add(
    box(cellWidth * 0.72, bar * 0.22, bar * 0.08),
    labelPaper,
    new Vector3(0, showcaseY + bar * 0.18, depth * 0.24),
  )

  const screw = geometry(
    new CylinderGeometry(bar * 0.07, bar * 0.07, bar * 0.08, 16),
  )
  for (const x of [-width / 2 + bar * 0.42, width / 2 - bar * 0.42])
    for (const y of [bar * 0.42, height - bar * 0.42]) {
      const pin = add(screw, brass, new Vector3(x, y, depth / 2 + bar * 0.04))
      pin.rotation.x = Math.PI / 2
    }

  const pane = add(
    geometry(new PlaneGeometry(width - bar * 1.4, height - bar * 1.4)),
    glass,
    new Vector3(0, height / 2, depth / 2 + bar * 0.12),
  )
  pane.rotation.y = Math.PI
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
      geometries.forEach((item) => item.dispose())
      materials.forEach((item) => item.dispose())
    },
  }
}
