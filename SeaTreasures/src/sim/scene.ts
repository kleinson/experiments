import {
  Box3,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Plane,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from 'three'
import { createShellGeometry, createSpireGeometry } from '../geometry.ts'
import { getShape } from '../model.ts'
import {
  adultAngle,
  builtAngle,
  coilPoint,
  coilScale,
  septumAngles,
} from './coil.ts'
import type { LifeFrame } from './life.ts'
import { looks } from './looks.ts'
import { coilGeometry, lipGeometry, septumGeometry, toThree } from './meshes.ts'
import { patternPixels, weather } from './patterns.ts'
import type { Pixels, Rgb } from './patterns.ts'
import { shapes } from './shapes.ts'
import type { Species } from './species.ts'

const TAU = Math.PI * 2
const UP = new Vector3(0, 1, 0)
const rgb = ([r, g, b]: Rgb) => new Color(r / 255, g / 255, b / 255)

export type SceneOptions = { cut: boolean; xray: boolean }

/** The cut-through plane, fixed in the world: it removes the half of the shell nearest the viewer. */
export const cutPlane = new Plane(new Vector3(0, 0, -1), 0)

/** Living parts that move without rebuilding. */
export type Rig = {
  /** Head, foot, tentacles: shrink toward `pivot` when the animal withdraws. */
  outside: Group
  /** The shell itself: lifts off the soft body when the reader takes it apart. */
  shell: Group
  crab: Group
  /** How far "take apart" lifts the shell. */
  reach: number
}

/** Everything one frame needs, with a dispose that frees every GPU resource. */
export type Built = {
  group: Group
  /** The specimen as one movable piece: shell, animal and any crab. */
  specimen: Group
  rig: Rig | null
  eggs: Mesh[]
  /** What the camera should look at, and the space it needs (mm), for the adult and for now. */
  view: { target: Vector3; width: number; height: number }
  close: { target: Vector3; width: number; height: number } | null
  /** Size of the adult shell's longest side, mm. */
  extent: number
  /** How far the scene may bob when it is afloat, mm. */
  bob: number
  /** Height of the sea floor or sand. */
  floor: number
  dispose: () => void
}

const patternCache = new Map<string, Pixels>()
function patternFor(species: Species) {
  const look = looks[species.id]!
  let pixels = patternCache.get(species.id)
  if (!pixels) {
    pixels = patternPixels(
      look.pattern,
      look.seed,
      ...(look.size ?? [512, 192]),
    )
    patternCache.set(species.id, pixels)
  }
  return pixels
}

function textureFrom(pixels: Pixels) {
  const canvas = document.createElement('canvas')
  canvas.width = pixels.width
  canvas.height = pixels.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('The shell pattern could not be drawn.')
  context.putImageData(
    new ImageData(pixels.data, pixels.width, pixels.height),
    0,
    0,
  )
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  map.wrapT = RepeatWrapping
  map.anisotropy = 4
  return map
}

function track() {
  const geometries: BufferGeometry[] = []
  const materials: Material[] = []
  const textures: CanvasTexture[] = []
  return {
    geometry<T extends BufferGeometry>(value: T) {
      geometries.push(value)
      return value
    },
    material<T extends Material>(value: T) {
      materials.push(value)
      return value
    },
    texture(value: CanvasTexture) {
      textures.push(value)
      return value
    },
    dispose() {
      geometries.forEach((item) => item.dispose())
      materials.forEach((item) => item.dispose())
      textures.forEach((item) => item.dispose())
    },
  }
}
type Own = ReturnType<typeof track>

const tube = (
  points: Vector3[],
  radius: number,
  own: Own,
  material: Material,
  taper = false,
) => {
  const geometry = new TubeGeometry(
    new CatmullRomCurve3(points),
    24,
    radius,
    10,
    false,
  )
  if (taper) {
    const position = geometry.getAttribute('position')
    const curve = new CatmullRomCurve3(points)
    for (let ring = 0; ring <= 24; ring++) {
      const centre = curve.getPoint(ring / 24)
      const keep = 1 - 0.75 * (ring / 24)
      for (let k = 0; k <= 10; k++) {
        const index = ring * 11 + k
        const p = new Vector3()
          .fromBufferAttribute(position, index)
          .sub(centre)
          .multiplyScalar(keep)
          .add(centre)
        position.setXYZ(index, p.x, p.y, p.z)
      }
    }
    geometry.computeVertexNormals()
  }
  return new Mesh(own.geometry(geometry), material)
}

const blob = (
  radii: [number, number, number],
  own: Own,
  material: Material,
) => {
  const mesh = new Mesh(own.geometry(new SphereGeometry(1, 32, 20)), material)
  mesh.scale.set(...radii)
  return mesh
}

/**
 * How each shell sits in life. Snails lie with the opening down on their foot,
 * the front (siphonal) end forward along +x. The nautilus hangs in the water
 * with its coil upright and its opening forward and a little down.
 */
function poseFor(species: Species): Quaternion {
  const shape = shapes[species.id]!
  if (shape.kind === 'cowrie')
    return new Quaternion().setFromAxisAngle(UP, Math.PI)
  const coil = shape.coil
  const last = adultAngle(coil)
  const v = (theta: number, s: number, inset = 0) =>
    new Vector3(...toThree(coilPoint(coil, theta, s, { inset }), 1))
  const apex = v(0.05, 0)
  const mouth = v(last, 0, 1)
  if (species.group === 'cephalopod') {
    // The coil stands upright; its opening faces forward (+x) and a little down.
    const axis = new Vector3(0, 1, 0)
    const upright = new Quaternion().setFromUnitVectors(
      axis,
      new Vector3(0, 0, 1),
    )
    const a = mouth.clone().sub(apex).applyQuaternion(upright)
    const want = new Vector3(1, -0.35, 0)
    const spin = Math.atan2(want.y, want.x) - Math.atan2(a.y, a.x)
    return new Quaternion()
      .setFromAxisAngle(new Vector3(0, 0, 1), spin)
      .multiply(upright)
  }
  // A snail lies on its foot. The coil axis runs from the apex at the back to the
  // front canal (+x), and the shell is rolled so its opening faces the floor.
  const along = new Vector3(0, -1, 0)
  const toFront = new Quaternion().setFromUnitVectors(
    along,
    new Vector3(1, 0, 0),
  )
  // The opening faces the direction the shell grows in: along the coil, not out from its axis.
  const opening = v(last + 0.02, 0, 1)
    .sub(mouth)
    .setY(0)
    .applyQuaternion(toFront)
  const roll = Math.atan2(opening.z, -opening.y)
  return new Quaternion()
    .setFromAxisAngle(new Vector3(1, 0, 0), roll)
    .multiply(toFront)
}

/** Builds the shell meshes for a given size, in the shell's own coordinates. */
function shellMeshes(
  species: Species,
  size: number,
  lip: number,
  outer: Material,
  inner: Material,
  extra: Material,
  own: Own,
) {
  const shape = shapes[species.id]!
  const length = species.lengthMm.drawn
  const group = new Group()
  if (shape.kind === 'coil') {
    const scale = coilScale(shape.coil, length)
    const end = builtAngle(shape.coil, size)
    const flare = size >= 0.999 ? lip : 0
    group.add(
      new Mesh(
        own.geometry(
          coilGeometry(shape.coil, scale, end, { flare, detail: 0.8 }),
        ),
        outer,
      ),
    )
    group.add(
      new Mesh(
        own.geometry(
          coilGeometry(shape.coil, scale, end, {
            flare,
            inset: shape.wall,
            detail: 0.8,
          }),
        ),
        inner,
      ),
    )
    group.add(
      new Mesh(
        own.geometry(lipGeometry(shape.coil, scale, end, shape.wall, flare)),
        outer,
      ),
    )
    if (shape.chambers) {
      const septa = septumAngles(
        end,
        shape.chambers.perTurn,
        shape.chambers.bodyChamber,
      )
      for (const theta of septa)
        group.add(
          new Mesh(
            own.geometry(septumGeometry(shape.coil, scale, theta, shape.wall)),
            inner,
          ),
        )
      if (septa.length > 1) {
        const points: Vector3[] = []
        for (
          let theta = septa[0]! - 0.3;
          theta <= septa[septa.length - 1]! + 0.3;
          theta += 0.08
        )
          points.push(
            new Vector3(
              ...toThree(
                coilPoint(shape.coil, theta, Math.PI, { inset: 0.75 }),
                scale,
              ),
            ),
          )
        group.add(
          new Mesh(
            own.geometry(
              new TubeGeometry(
                new CatmullRomCurve3(points),
                points.length * 2,
                length * 0.006,
                8,
                false,
              ),
            ),
            extra,
          ),
        )
      }
    }
    return { group, scale, end, flare, coil: shape.coil, wall: shape.wall }
  }
  const progress = Math.min(100, size * 100)
  const now = getShape(progress)
  const unit = (length / 3.56) * (size / now.scale)
  const body = new Group()
  body.scale.set(unit, unit * shape.height, unit * shape.width)
  body.add(new Mesh(own.geometry(createShellGeometry(progress)), outer))
  body.add(
    new Mesh(own.geometry(createShellGeometry(progress, 'inner')), inner),
  )
  if (now.coilVisibility > 0) {
    const spire = new Mesh(own.geometry(createSpireGeometry()), outer)
    spire.scale.setScalar(now.scale)
    body.add(spire)
  }
  group.add(body)
  return { group, unit, progress, cowrie: shape, now }
}

const framing = new Map<
  string,
  { width: number; height: number; length: number; depth: number }
>()
/** The adult shell in its life pose, measured once per species. */
function adultBox(species: Species) {
  const cached = framing.get(species.id)
  if (cached) return cached
  const own = track()
  const plain = own.material(new MeshStandardMaterial())
  const built = shellMeshes(species, 1, 1, plain, plain, plain, own)
  built.group.quaternion.copy(poseFor(species))
  built.group.updateMatrixWorld(true)
  const box = new Box3().setFromObject(built.group)
  const size = box.getSize(new Vector3())
  own.dispose()
  const result = {
    width: size.x,
    height: size.y,
    length: Math.max(size.x, size.y, size.z),
    depth: size.z,
  }
  framing.set(species.id, result)
  return result
}

/** A soft, rounded substrate: sea floor or sand. */
function ground(radius: number, colour: Rgb, own: Own) {
  const side = 128
  const pixels: Pixels = {
    width: side,
    height: side,
    data: new Uint8ClampedArray(side * side * 4),
  }
  let seed = 11
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647
    const grain = 0.86 + ((seed % 1000) / 1000) * 0.22
    pixels.data[i] = colour[0] * grain
    pixels.data[i + 1] = colour[1] * grain
    pixels.data[i + 2] = colour[2] * grain
    pixels.data[i + 3] = 255
  }
  const map = own.texture(textureFrom(pixels))
  map.wrapS = RepeatWrapping
  map.repeat.set(6, 6)
  const mesh = new Mesh(
    own.geometry(new CircleGeometry(radius, 72)),
    own.material(new MeshStandardMaterial({ map, roughness: 1 })),
  )
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

const SAND: Rgb = [214, 196, 160]
const SEAFLOOR: Rgb = [154, 160, 152]

/**
 * A snail's outside, built around the seated shell `box`: a broad foot under
 * the shell, a head with tentacles and eyes at the front, and a siphon. Parts
 * hang from a pivot at the shell's opening so they can withdraw into it.
 */
function snailBody(
  box: Box3,
  footTop: number,
  tissue: Material,
  eye: Material,
  own: Own,
  cowrie: boolean,
) {
  const outside = new Group()
  const L = box.max.x - box.min.x
  const W = box.max.z - box.min.z
  const H = box.max.y - box.min.y
  const mid = (box.min.z + box.max.z) / 2
  const front = box.max.x
  const pivot = new Vector3(front - L * 0.3, box.min.y + H * 0.15, mid)
  const place = (mesh: Mesh) => {
    mesh.position.sub(pivot)
    outside.add(mesh)
  }
  const foot = blob(
    [L * 0.62, footTop * 0.55, Math.max(W * 0.45, L * 0.17)],
    own,
    tissue,
  )
  foot.position.set(box.min.x + L * 0.58, footTop * 0.5, mid)
  place(foot)
  const headAt = new Vector3(front + L * 0.04, footTop * 1.5, mid)
  const head = blob([L * 0.09, footTop * 0.9, L * 0.08], own, tissue)
  head.position.copy(headAt)
  place(head)
  for (const sign of [-1, 1]) {
    const base = headAt
      .clone()
      .add(new Vector3(L * 0.03, footTop * 0.3, sign * L * 0.035))
    const tip = base
      .clone()
      .add(new Vector3(L * 0.2, L * 0.07, sign * L * 0.12))
    const middle = base
      .clone()
      .lerp(tip, 0.5)
      .add(new Vector3(0, L * 0.03, 0))
    place(tube([base, middle, tip], L * 0.011, own, tissue, true))
    const eyeBall = blob([L * 0.012, L * 0.012, L * 0.012], own, eye)
    eyeBall.position.copy(base).add(new Vector3(0, L * 0.004, sign * L * 0.018))
    place(eyeBall)
  }
  const siphonBase = cowrie
    ? new Vector3(front - L * 0.01, footTop * 1.4, mid)
    : new Vector3(front - L * 0.04, box.min.y + H * 0.35, mid)
  const siphonTip = cowrie
    ? siphonBase.clone().add(new Vector3(L * 0.07, footTop * 0.8, 0))
    : siphonBase.clone().add(new Vector3(L * 0.14, H * 0.35, 0))
  place(
    tube(
      [
        siphonBase,
        siphonBase
          .clone()
          .lerp(siphonTip, 0.5)
          .add(new Vector3(L * 0.02, 0, 0)),
        siphonTip,
      ],
      L * (cowrie ? 0.018 : 0.022),
      own,
      tissue,
    ),
  )
  outside.position.copy(pivot)
  return outside
}

export function buildScene(
  species: Species,
  frame: LifeFrame,
  options: SceneOptions,
): Built {
  const own = track()
  const group = new Group()
  const specimen = new Group()
  group.add(specimen)
  const look = looks[species.id]!
  const shape = shapes[species.id]!
  const length = species.lengthMm.drawn
  const adult = adultBox(species)
  const pose = poseFor(species)
  const swims = species.group === 'cephalopod'
  const clipping = options.cut ? [cutPlane] : []
  const shellMaterial = <T extends MeshStandardMaterial>(material: T) => {
    material.side = DoubleSide
    material.clippingPlanes = clipping
    if (options.xray) {
      material.transparent = true
      material.opacity = 0.18
      material.depthWrite = false
    }
    return own.material(material)
  }
  const tissue = own.material(
    new MeshPhysicalMaterial({
      color: rgb(look.tissue),
      roughness: 0.55,
      sheen: 0.6,
      sheenColor: rgb(look.tissue).multiplyScalar(1.4),
      transparent: frame.animal < 1,
      opacity: Math.max(0, frame.animal),
    }),
  )
  const eye = own.material(
    new MeshStandardMaterial({
      color: rgb([28, 24, 22]),
      roughness: 0.2,
      transparent: frame.animal < 1,
      opacity: frame.animal,
    }),
  )
  const wear = Math.round(frame.wear * 10) / 10
  let rig: Rig | null = null
  const eggs: Mesh[] = []
  let close: Built['close'] = null
  let bob = 0
  const floor = 0

  if (frame.size > 0) {
    const pixels =
      wear > 0 ? weather(patternFor(species), wear) : patternFor(species)
    const outer = shellMaterial(
      new MeshPhysicalMaterial({
        map: own.texture(textureFrom(pixels)),
        roughness: 0.25 + wear * 0.8,
        clearcoat: shape.kind === 'cowrie' ? 1 - wear : 0.35 * (1 - wear),
        clearcoatRoughness: 0.12,
      }),
    )
    const inner = shellMaterial(
      look.nacre
        ? new MeshPhysicalMaterial({
            color: rgb(look.inside),
            roughness: 0.15,
            metalness: 0.1,
            iridescence: 1,
            iridescenceIOR: 1.35,
            iridescenceThicknessRange: [200, 700],
          })
        : new MeshStandardMaterial({ color: rgb(look.inside), roughness: 0.3 }),
    )
    const extra = shellMaterial(
      new MeshStandardMaterial({ color: rgb([150, 110, 90]), roughness: 0.5 }),
    )
    const built = shellMeshes(
      species,
      frame.size,
      frame.lip,
      outer,
      inner,
      extra,
      own,
    )

    const shell = new Group()
    shell.add(built.group)
    const body = new Group()
    for (const part of [shell, body]) part.quaternion.copy(pose)

    // Soft body inside the whorls: seen through X-ray, a cut, or by taking the shell off.
    if (frame.animal > 0) {
      if (built.coil) {
        const turns = swims ? 0.45 : 1.6
        const start = Math.max(0.05, built.end - TAU * turns)
        body.add(
          new Mesh(
            own.geometry(
              coilGeometry(built.coil, built.scale, built.end, {
                start,
                inset: built.wall + 0.12,
                detail: 0.6,
              }),
            ),
            tissue,
          ),
        )
      } else if (built.cowrie) {
        const cowrieBody = new Group()
        cowrieBody.scale.copy(built.group.children[0]!.scale)
        const coverage = frame.phase === 'adult' ? 55 : 30
        for (const side of ['mantle-left', 'mantle-right'] as const)
          cowrieBody.add(
            new Mesh(
              own.geometry(createShellGeometry(built.progress, side, coverage)),
              tissue,
            ),
          )
        cowrieBody.add(
          new Mesh(
            own.geometry(createShellGeometry(built.progress, 'inner')),
            tissue,
          ),
        )
        cowrieBody.children[cowrieBody.children.length - 1]!.scale.setScalar(
          0.94,
        )
        body.add(cowrieBody)
      }
    }

    // Drill hole or chips where the shell was attacked.
    if (frame.mark !== 'none' && built.coil) {
      const markMaterial = own.material(
        new MeshStandardMaterial({
          color: rgb([46, 36, 30]),
          roughness: 0.9,
          side: DoubleSide,
        }),
      )
      const at = (theta: number, s: number, inset = 0) =>
        new Vector3(
          ...toThree(
            coilPoint(built.coil!, theta, s, { inset, flare: built.flare }),
            built.scale,
          ),
        )
      if (frame.mark === 'drill') {
        const theta = built.end - Math.PI * 0.7
        const spot = at(theta, Math.PI * 0.9, -0.01)
        const normal = spot
          .clone()
          .sub(at(theta, Math.PI * 0.9, 0.5))
          .normalize()
        const hole = new Mesh(
          own.geometry(new CircleGeometry(length * 0.018, 20)),
          markMaterial,
        )
        hole.position.copy(spot)
        hole.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), normal)
        built.group.add(hole)
      } else {
        for (let i = 0; i < 3; i++) {
          const nick = blob(
            [length * 0.03, length * 0.016, length * 0.02],
            own,
            markMaterial,
          )
          nick.position.copy(at(built.end, 0.3 + i * 0.35, -0.02))
          built.group.add(nick)
        }
      }
    } else if (frame.mark === 'drill' && built.cowrie) {
      const hole = new Mesh(
        own.geometry(new CircleGeometry(0.06, 20)),
        own.material(
          new MeshStandardMaterial({
            color: rgb([46, 36, 30]),
            side: DoubleSide,
          }),
        ),
      )
      hole.position.set(0.4 * built.now.scale, 0.92 * built.now.scale, 0.2)
      hole.rotation.x = -Math.PI / 2.2
      built.group.children[0]!.add(hole)
    }

    specimen.add(body, shell)
    specimen.updateMatrixWorld(true)
    const box = new Box3().setFromObject(built.group)
    const centre = box.getCenter(new Vector3())
    const height = box.max.y - box.min.y
    const crabbed = frame.hermit > 0 && !swims
    const living = frame.animal > 0 && frame.larva === 0

    const footTop = Math.max(box.max.x - box.min.x, 1) * 0.06
    let lift = 0
    if (swims) lift = adult.height * 0.35
    else if (living) lift = footTop * 0.55
    else if (crabbed) lift = height * 0.18

    // Seat the shell: centred over the origin, resting on its foot, the sand, or in the water.
    const shift = new Vector3(-centre.x, floor + lift - box.min.y, -centre.z)
    shell.position.add(shift)
    body.position.add(shift)
    specimen.updateMatrixWorld(true)
    const seated = new Box3().setFromObject(built.group)

    let outside = new Group()
    if (swims && frame.animal > 0 && built.coil) {
      const mouthLocal = new Vector3(
        ...toThree(
          coilPoint(built.coil, built.end, 0, { inset: 1 }),
          built.scale,
        ),
      )
      const aheadLocal = new Vector3(
        ...toThree(
          coilPoint(built.coil, built.end + 0.05, 0, { inset: 1 }),
          built.scale,
        ),
      ).sub(mouthLocal)
      const mouth = shell.localToWorld(mouthLocal.clone())
      const ahead = aheadLocal.applyQuaternion(pose).normalize()
      const size = length * frame.size
      const parts: Mesh[] = []
      const hood = blob([size * 0.14, size * 0.1, size * 0.16], own, tissue)
      hood.position
        .copy(mouth)
        .addScaledVector(ahead, size * 0.03)
        .add(new Vector3(0, size * 0.1, 0))
      parts.push(hood)
      for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * TAU
        const ring = new Vector3(
          0,
          Math.sin(angle) * size * 0.12,
          Math.cos(angle) * size * 0.14,
        )
        const from = mouth.clone().add(ring.clone().multiplyScalar(0.6))
        const reach = size * (0.22 + ((i * 7) % 5) * 0.03)
        const to = mouth
          .clone()
          .addScaledVector(ahead, reach)
          .add(ring)
          .add(new Vector3(0, -size * 0.1, 0))
        const middle = from
          .clone()
          .lerp(to, 0.5)
          .add(new Vector3(0, -size * 0.05, 0))
        parts.push(tube([from, middle, to], size * 0.008, own, tissue, true))
      }
      for (const sign of [-1, 1]) {
        const eyeBall = blob(
          [size * 0.045, size * 0.045, size * 0.045],
          own,
          eye,
        )
        eyeBall.position
          .copy(mouth)
          .addScaledVector(ahead, -size * 0.02)
          .add(new Vector3(0, size * 0.04, sign * size * 0.15))
        parts.push(eyeBall)
      }
      for (const part of parts) {
        part.position.sub(mouth)
        outside.add(part)
      }
      outside.position.copy(mouth)
    } else if (living && !swims) {
      outside = snailBody(
        seated,
        footTop,
        tissue,
        eye,
        own,
        shape.kind === 'cowrie',
      )
    }
    specimen.add(outside)

    const crab = new Group()
    if (crabbed) {
      const crabMaterial = own.material(
        new MeshStandardMaterial({
          color: rgb([196, 92, 58]),
          roughness: 0.55,
        }),
      )
      const L = seated.max.x - seated.min.x
      const H = seated.max.y - seated.min.y
      const mouthAt = new Vector3(
        seated.max.x - L * 0.08,
        seated.min.y + H * 0.3,
        (seated.min.z + seated.max.z) / 2,
      )
      for (let leg = 0; leg < 6; leg++) {
        const sign = leg % 2 ? 1 : -1
        const along = Math.floor(leg / 2)
        const base = mouthAt
          .clone()
          .add(new Vector3(-along * L * 0.04, 0, sign * L * 0.04))
        const knee = base
          .clone()
          .add(new Vector3(L * 0.06, H * 0.25, sign * L * 0.1))
        const foot = new Vector3(
          knee.x + L * 0.04,
          floor,
          knee.z + sign * L * 0.04,
        )
        crab.add(tube([base, knee, foot], L * 0.011, own, crabMaterial))
      }
      for (const sign of [-1, 1]) {
        const claw = blob([L * 0.07, L * 0.035, L * 0.045], own, crabMaterial)
        claw.position
          .copy(mouthAt)
          .add(new Vector3(L * 0.1, -H * 0.05, sign * L * 0.035))
        crab.add(claw)
        const eyeAt = mouthAt
          .clone()
          .add(new Vector3(L * 0.09, H * 0.25, sign * L * 0.03))
        crab.add(
          tube(
            [
              mouthAt
                .clone()
                .add(new Vector3(L * 0.05, H * 0.05, sign * L * 0.015)),
              eyeAt,
            ],
            L * 0.006,
            own,
            crabMaterial,
          ),
        )
        const eyeBall = blob(
          [L * 0.012, L * 0.012, L * 0.012],
          own,
          own.material(new MeshStandardMaterial({ color: rgb([20, 20, 20]) })),
        )
        eyeBall.position.copy(eyeAt)
        crab.add(eyeBall)
      }
      specimen.add(crab)
    }

    rig = {
      outside,
      shell,
      crab,
      reach: adult.height * 1.3 + adult.length * 0.15,
    }

    if (frame.larva > 0 && !swims) {
      const velum = own.material(
        new MeshPhysicalMaterial({
          color: rgb([232, 216, 196]),
          roughness: 0.5,
          transparent: true,
          opacity: 0.8,
          side: DoubleSide,
          sheen: 1,
        }),
      )
      const lobe = Math.max(height, box.max.x - box.min.x) * 0.7
      for (const sign of [-1, 1]) {
        const disc = new Mesh(own.geometry(new CircleGeometry(lobe, 32)), velum)
        disc.position.set(
          sign * lobe * 0.75,
          floor + lift + height * 1.15 + lobe * 0.2,
          0,
        )
        disc.rotation.set(-Math.PI / 2.4, 0, sign * 0.4)
        specimen.add(disc)
      }
      const rimMaterial = own.material(
        new MeshStandardMaterial({ color: rgb([200, 160, 130]) }),
      )
      for (const sign of [-1, 1]) {
        const points: Vector3[] = []
        for (let k = 0; k <= 24; k++) {
          const a = (k / 24) * TAU
          points.push(
            new Vector3(
              sign * lobe * 0.75 + Math.cos(a) * lobe,
              floor +
                lift +
                height * 1.15 +
                lobe * 0.2 +
                Math.sin(a) * lobe * 0.25,
              Math.sin(a) * lobe * 0.95,
            ),
          )
        }
        specimen.add(tube(points, lobe * 0.03, own, rimMaterial))
      }
      specimen.updateMatrixWorld(true)
      const larvaBox = new Box3().setFromObject(specimen)
      const larvaSize = larvaBox.getSize(new Vector3())
      close = {
        target: larvaBox.getCenter(new Vector3()),
        width: Math.max(larvaSize.x, larvaSize.z) * 2.2,
        height: larvaSize.y * 2.6,
      }
      bob = close.height * 0.04
    }
    if (swims && frame.larva > 0) {
      // A hatchling nautilus: frame it closely so its first chambers can be seen.
      specimen.updateMatrixWorld(true)
      const hatchBox = new Box3().setFromObject(specimen)
      const hatch = hatchBox.getSize(new Vector3())
      close = {
        target: hatchBox.getCenter(new Vector3()),
        width: Math.max(hatch.x, hatch.z) * 3,
        height: hatch.y * 3.4,
      }
      bob = close.height * 0.03
    }
    if (frame.drift > 0) bob = adult.height * 0.06
    if (swims && frame.animal > 0) bob = Math.max(bob, adult.height * 0.02)
    if (frame.drift > 0) specimen.position.y += frame.drift * adult.height * 0.5
  }

  if (frame.egg > 0) {
    const eggMaterial = own.material(
      new MeshPhysicalMaterial({
        color: rgb([238, 228, 200]),
        roughness: 0.35,
        transmission: 0.4,
        thickness: 1,
        sheen: 0.4,
      }),
    )
    const embryo = own.material(
      new MeshStandardMaterial({ color: rgb([196, 150, 110]) }),
    )
    const big = swims
    const eggSize = big ? length * 0.14 : Math.max(0.25, length * 0.012)
    const count = big ? 3 : 48
    for (let i = 0; i < count; i++) {
      const angle = i * 2.39996
      const ring = Math.sqrt(i + 0.5) * eggSize * 1.05
      const egg = blob(
        [
          eggSize * 0.5,
          eggSize * (big ? 0.36 : 0.5),
          eggSize * (big ? 0.36 : 0.5),
        ],
        own,
        eggMaterial,
      )
      egg.position.set(
        Math.cos(angle) * ring,
        floor + eggSize * 0.42,
        Math.sin(angle) * ring,
      )
      egg.userData.egg = i
      const dot = blob(
        [eggSize * 0.16, eggSize * 0.16, eggSize * 0.16],
        own,
        embryo,
      )
      egg.add(dot)
      dot.scale.divide(egg.scale).multiplyScalar(eggSize * 0.18)
      eggs.push(egg)
      group.add(egg)
    }
    const spread = Math.sqrt(count) * eggSize * 2.6
    close = {
      target: new Vector3(0, eggSize, 0),
      width: spread * 1.4,
      height: spread,
    }
  }

  const sand = frame.beach
  const showFloor =
    (!swims && frame.larva === 0) || frame.beach || frame.phase === 'egg'
  if (showFloor) {
    const floorMesh = ground(adult.length * 2.2, sand ? SAND : SEAFLOOR, own)
    floorMesh.position.y = floor - 0.05
    group.add(floorMesh)
  }

  if (frame.beach) {
    specimen.rotation.y = 0.5
  }

  const target = new Vector3(
    0,
    floor + (swims ? adult.height * 0.85 : adult.height * 0.55),
    0,
  )
  return {
    group,
    specimen,
    rig,
    eggs,
    view: {
      target,
      width: adult.length * 1.9,
      height: adult.height * 2.4 + (swims ? 0 : adult.length * 0.25),
    },
    close,
    extent: adult.length,
    bob,
    floor,
    dispose: own.dispose,
  }
}
