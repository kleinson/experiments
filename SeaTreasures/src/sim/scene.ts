import {
  Box3,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  Float32BufferAttribute,
  Color,
  DoubleSide,
  Group,
  Material,
  Mesh,
  Object3D,
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
import { shellPoint } from '../shellform.ts'
import {
  adultAngle,
  builtAngle,
  coilPoint,
  coilScale,
  septumAngles,
} from './coil.ts'
import { cap, footGeometry, limb, papillae, skinMaterials } from './bodies.ts'
import { marker, markMesh } from './labels.ts'
import { buildClassAnimal } from './classes.ts'
import { buildPearl, pearlFor } from './pearls.ts'
import { buildVelum } from './velum.ts'
import type { Velum } from './velum.ts'
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

export type SceneOptions = {
  cut: boolean
  xray: boolean
  /** A step of the pearl growing inside a living clam (pearls.ts), or null for none. */
  pearl?: number | null
}

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
  /** A swimming larva's velum: shrinks into the shell when it withdraws, and its cilia beat. */
  velum: Velum | null
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
  if (shape.kind === 'class') return new Quaternion()
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
  // A snail crawls with its opening pressed onto its foot: the coil axis runs from the apex at
  // the back to the front canal (+x), and the shell is rolled until the opening is its lowest
  // part, facing down. The spire is lifted a little, as a crawling snail carries it.
  const cached = snailPoses.get(species.id)
  if (cached) return cached.clone()
  const toFront = new Quaternion().setFromUnitVectors(
    new Vector3(0, -1, 0),
    new Vector3(1, 0, 0),
  )
  const body: Vector3[] = []
  for (let theta = Math.max(0.05, last - TAU); theta <= last; theta += 0.08)
    for (let s = 0; s < TAU; s += 0.3)
      body.push(
        new Vector3(...toThree(coilPoint(coil, theta, s, { flare: 1 }), 1)),
      )
  const ring = Array.from({ length: 36 }, (_, i) =>
    v(last - 0.25, (i / 36) * TAU, 0.4),
  )
  const facing = v(last + 0.03, 0, 1)
    .sub(mouth)
    .normalize()
  const lift = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -0.18)
  let best = { score: Infinity, pose: new Quaternion() }
  const turned = new Vector3()
  for (let roll = 0; roll < TAU; roll += 0.02) {
    const pose = lift
      .clone()
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), roll))
      .multiply(toFront)
    let low = Infinity
    let high = -Infinity
    for (const p of body) {
      const y = turned.copy(p).applyQuaternion(pose).y
      low = Math.min(low, y)
      high = Math.max(high, y)
    }
    const opening =
      ring.reduce((sum, p) => sum + turned.copy(p).applyQuaternion(pose).y, 0) /
      ring.length
    // Lowest opening, facing down: the score falls as both improve.
    const score =
      (opening - low) / (high - low) +
      0.35 * turned.copy(facing).applyQuaternion(pose).y
    if (score < best.score) best = { score, pose }
  }
  snailPoses.set(species.id, best.pose)
  return best.pose.clone()
}
const snailPoses = new Map<string, Quaternion>()

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
  if (shape.kind === 'class')
    throw new Error(`${species.id} is built whole in classes.ts`)
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
    const at = (
      theta: number,
      s: number,
      options: { inset?: number; flare?: number } = {},
    ) =>
      new Vector3(...toThree(coilPoint(shape.coil, theta, s, options), scale))
    if (shape.chambers) {
      const septa = septumAngles(
        end,
        shape.chambers.perTurn,
        shape.chambers.bodyChamber,
      )
      group.add(marker('Living chamber', at(end - 0.7, 0, { inset: 0.55 })))
      if (septa.length > 1) {
        const last = septa[septa.length - 1]!
        group.add(marker('Septum', at(last, 0.6, { inset: 0.5 }), true))
        group.add(
          marker(
            'Siphuncle',
            at(septa[Math.floor(septa.length / 2)]!, Math.PI, { inset: 0.75 }),
            true,
          ),
        )
      }
    } else {
      group.add(marker('Apex', at(0.05, 0)))
      group.add(marker('Aperture', at(end, 0, { inset: 1, flare })))
      if (end > TAU * 1.5) {
        group.add(marker('Body whorl', at(end - Math.PI * 0.8, 0)))
        const axis = at(end - TAU, 0, { inset: 1 })
        group.add(marker('Columella', new Vector3(0, axis.y, 0), true))
      }
      if (shape.coil.flare && flare > 0.5)
        group.add(
          marker('Thick lip', at(end - 0.15, shape.coil.flare.at, { flare })),
        )
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
    if (now.coilVisibility > 0.3) markMesh(spire, 'Young spire')
  }
  const outerShell = body.children[0] as Mesh
  outerShell.geometry.computeBoundingBox()
  const bounds = outerShell.geometry.boundingBox!
  const middle = bounds.getCenter(new Vector3())
  body.add(marker('Dorsum', new Vector3(middle.x, bounds.max.y, middle.z)))
  body.add(
    marker(
      progress >= 95 ? 'Toothed aperture' : 'Aperture',
      new Vector3(middle.x, bounds.min.y, middle.z),
    ),
  )
  group.add(body)
  return { group, unit, progress, cowrie: shape, now }
}

const framing = new Map<
  string,
  { width: number; height: number; length: number; depth: number }
>()
/** The adult shell in its life pose, measured once per species. */
function adultBox(species: Species) {
  // Keyed by size too: a local form can be drawn at another length.
  const frameKey = `${species.id}:${species.lengthMm.drawn}`
  const cached = framing.get(frameKey)
  if (cached) return cached
  const own = track()
  const plain = own.material(new MeshStandardMaterial())
  const shape = shapes[species.id]!
  const measured = new Group()
  if (shape.kind === 'class') {
    const whole = buildClassAnimal(
      shape.class,
      species.lengthMm.drawn,
      1,
      1,
      own,
      {
        shell: plain,
        inner: plain,
        tissue: plain,
      },
    )
    measured.add(whole.shell)
  } else {
    const built = shellMeshes(species, 1, 1, plain, plain, plain, own)
    built.group.quaternion.copy(poseFor(species))
    measured.add(built.group)
  }
  measured.updateMatrixWorld(true)
  const box = new Box3().setFromObject(measured)
  const size = box.getSize(new Vector3())
  own.dispose()
  const result = {
    width: size.x,
    height: size.y,
    length: Math.max(size.x, size.y, size.z),
    depth: size.z,
  }
  framing.set(frameKey, result)
  return result
}

type BodyMaterials = ReturnType<typeof skinMaterials>

/** Height of the shell's underside along its length (x), in `stations` steps: where the foot must reach. */
function underside(shell: Object3D, stations: number) {
  const points: Vector3[] = []
  const v = new Vector3()
  shell.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const position = mesh.geometry.getAttribute('position')
    for (let i = 0; i < position.count; i += 2)
      points.push(
        v
          .fromBufferAttribute(position, i)
          .applyMatrix4(mesh.matrixWorld)
          .clone(),
      )
  })
  let minX = Infinity
  let maxX = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
  }
  const low = new Array<number>(stations).fill(Infinity)
  for (const p of points) {
    const k = Math.min(
      stations - 1,
      Math.floor(((p.x - minX) / (maxX - minX || 1)) * stations),
    )
    low[k] = Math.min(low[k]!, p.y)
  }
  for (let k = 0; k < stations; k++)
    if (!Number.isFinite(low[k]!)) low[k] = low[k - 1] ?? 0
  return { minX, maxX, low }
}

/**
 * A snail's outside, built around the seated shell `box`: one continuous
 * head-foot with a creeping sole, a head with tapered tentacles and eyes, and
 * species features (siphon, eye stalks and operculum, proboscis). It hangs
 * from a pivot at the shell's opening so it can withdraw into it.
 */
function snailBody(
  box: Box3,
  footTop: number,
  skin: BodyMaterials,
  own: Own,
  speciesId: string,
  under: ReturnType<typeof underside>,
  opening: Vector3 | null,
) {
  const outside = new Group()
  const L = box.max.x - box.min.x
  const W = box.max.z - box.min.z
  const H = box.max.y - box.min.y
  const mid = (box.min.z + box.max.z) / 2
  const front = box.max.x
  const conch = speciesId === 'queen-conch'
  const cowrie = speciesId.endsWith('cowrie')
  const pivot = new Vector3(front - L * 0.3, box.min.y + H * 0.15, mid)
  const add = <T extends Object3D>(part: T) => {
    part.position.sub(pivot)
    outside.add(part)
    return part
  }
  const geo = <T extends BufferGeometry>(g: T) => own.geometry(g)

  // The foot: a long, soft slug shape with a flat sole, reaching beyond the shell at both ends.
  const footLength = L * (conch ? 0.95 : 1.18)
  const footWidth = Math.max(W * 0.72, L * 0.3)
  const footX = box.min.x + L * 0.5 + L * (conch ? 0.12 : 0.1)
  const foot = add(
    new Mesh(
      geo(footGeometry(footLength, footWidth, footTop * 1.15)),
      skin.flesh,
    ),
  )
  foot.position.add(new Vector3(footX, 0, mid))

  // The body between foot and shell: one smooth mass whose top follows the underside of the
  // shell along its length, so the shell rests on the animal instead of floating.
  const stations = under.low.length
  const rows = 40
  const around = 24
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const tops: number[] = []
  for (let k = 0; k < stations; k++)
    tops.push(
      Math.min(
        footTop * 2.2,
        Math.max(footTop * 0.9, under.low[k]! + footTop * 0.15),
      ),
    )
  const topAt = (t: number) => {
    const x = t * (stations - 1)
    const i = Math.min(stations - 2, Math.floor(x))
    const f = x - i
    const smooth = f * f * (3 - 2 * f)
    return tops[i]! + (tops[i + 1]! - tops[i]!) * smooth
  }
  const halfWidth = Math.min(footWidth * 0.36, W * 0.34)
  for (let r = 0; r <= rows; r++) {
    const t = r / rows
    const x = under.minX + (under.maxX - under.minX) * (0.04 + 0.9 * t)
    const end = Math.sin(Math.PI * (0.04 + 0.92 * t))
    const top = footTop * 0.4 + (topAt(t) - footTop * 0.4) * Math.pow(end, 0.35)
    const w = halfWidth * Math.pow(end, 0.5)
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI
      positions.push(
        x,
        footTop * 0.4 + (top - footTop * 0.4) * Math.sin(a),
        mid + Math.cos(a) * w,
      )
      uvs.push(t * 3, j / around)
      if (r < rows && j < around) {
        const i0 = r * (around + 1) + j
        indices.push(
          i0,
          i0 + around + 1,
          i0 + 1,
          i0 + around + 1,
          i0 + around + 2,
          i0 + 1,
        )
      }
    }
  }
  const massGeometry = new BufferGeometry()
  massGeometry.setAttribute(
    'position',
    new Float32BufferAttribute(positions, 3),
  )
  massGeometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  massGeometry.setIndex(indices)
  massGeometry.computeVertexNormals()
  add(new Mesh(geo(massGeometry), skin.flesh))
  const sole = add(
    new Mesh(
      geo(footGeometry(footLength * 0.985, footWidth * 0.97, footTop * 0.12)),
      skin.sole,
    ),
  )
  sole.position.add(new Vector3(footX, -footTop * 0.02, mid))
  add(
    marker(
      'Foot',
      new Vector3(
        footX + footLength * 0.36,
        footTop * 0.55,
        mid + footWidth * 0.3,
      ),
    ),
  )

  // The body runs out of the opening: a soft, thick column from inside the shell down onto the foot,
  // so the animal is visibly in its shell rather than beside it.
  if (opening) {
    const inside = opening.clone()
    const onFoot = new Vector3(
      Math.min(opening.x, footX + footLength * 0.15),
      footTop * 0.95,
      mid,
    )
    add(
      new Mesh(
        geo(
          limb(
            [
              inside,
              inside
                .clone()
                .lerp(onFoot, 0.5)
                .add(new Vector3(0, footTop * 0.2, 0)),
              onFoot,
            ],
            Math.min(footWidth * 0.32, L * 0.11),
            1,
            16,
          ),
        ),
        skin.flesh,
      ),
    )
    add(
      new Mesh(
        geo(cap(inside, Math.min(footWidth * 0.3, L * 0.1))),
        skin.flesh,
      ),
    )
  }

  // The head rises from the front of the foot on a short neck.
  const headAt = new Vector3(footX + footLength * 0.42, footTop * 1.15, mid)
  const neck = add(
    new Mesh(
      geo(
        limb(
          [
            new Vector3(footX + footLength * 0.18, footTop * 0.9, mid),
            new Vector3(footX + footLength * 0.32, footTop * 1.2, mid),
            headAt,
          ],
          footTop * 0.62,
          0.8,
          12,
        ),
      ),
      skin.flesh,
    ),
  )
  void neck
  add(new Mesh(geo(cap(headAt, footTop * 0.5)), skin.flesh))

  for (const sign of [-1, 1]) {
    const base = headAt
      .clone()
      .add(new Vector3(L * 0.01, footTop * 0.25, sign * footTop * 0.35))
    if (conch) {
      // Long eye stalks that move independently (queen-conch-appearance), eyes at their tips.
      const tip = base
        .clone()
        .add(new Vector3(L * 0.14, L * 0.09, sign * L * 0.07))
      const bend = base
        .clone()
        .lerp(tip, 0.5)
        .add(new Vector3(-L * 0.01, L * 0.03, 0))
      add(
        new Mesh(geo(limb([base, bend, tip], L * 0.012, 0.75, 20)), skin.flesh),
      )
      add(new Mesh(geo(cap(tip, L * 0.016)), skin.eye))
      if (sign > 0) add(marker('Eye stalk', bend))
      const ring = add(
        new Mesh(
          geo(
            cap(
              tip
                .clone()
                .addScaledVector(
                  new Vector3(-1, -0.4, 0).normalize(),
                  L * 0.006,
                ),
              L * 0.019,
            ),
          ),
          skin.flesh,
        ),
      )
      void ring
    } else {
      // Cephalic tentacles that taper to a point, with an eye near the base of each.
      const tip = base
        .clone()
        .add(new Vector3(L * 0.18, L * 0.08, sign * L * 0.11))
      const bend = base
        .clone()
        .lerp(tip, 0.45)
        .add(new Vector3(0, L * 0.035, 0))
      add(
        new Mesh(geo(limb([base, bend, tip], L * 0.011, 0.12, 22)), skin.flesh),
      )
      if (cowrie && sign > 0)
        add(marker('Tentacle', base.clone().lerp(tip, 0.7)))
      add(
        new Mesh(
          geo(
            cap(
              base
                .clone()
                .add(new Vector3(L * 0.012, L * 0.004, sign * L * 0.012)),
              L * 0.009,
            ),
          ),
          skin.eye,
        ),
      )
    }
  }
  if (conch) {
    // The tube-like mouth (proboscis) reaching to the ground, and the brown operculum on the back of the foot.
    const mouth = headAt.clone().add(new Vector3(L * 0.03, -footTop * 0.3, 0))
    add(
      new Mesh(
        geo(
          limb(
            [
              mouth,
              mouth.clone().add(new Vector3(L * 0.07, -footTop * 0.2, 0)),
              mouth.clone().add(new Vector3(L * 0.13, -footTop * 0.7, 0)),
            ],
            footTop * 0.2,
            0.7,
            14,
          ),
        ),
        skin.flesh,
      ),
    )
    add(
      marker(
        'Proboscis',
        mouth.clone().add(new Vector3(L * 0.08, -footTop * 0.3, 0)),
      ),
    )
    const operculum = add(
      new Mesh(
        geo(new SphereGeometry(1, 24, 12)),
        own.material(
          new MeshPhysicalMaterial({
            color: rgb([96, 62, 34]),
            roughness: 0.75,
            clearcoat: 0.2,
          }),
        ),
      ),
    )
    operculum.scale.set(L * 0.09, footTop * 0.12, L * 0.035)
    operculum.position.add(
      new Vector3(
        footX - footLength * 0.08,
        footTop * 1.1,
        mid + footWidth * 0.18,
      ),
    )
    operculum.rotation.set(0.5, 0.3, 0.6)
    markMesh(operculum, 'Operculum')
  }

  // The inhalant siphon: a soft tube rising from the front of the opening. Sourced for cowries
  // (cowrie-animal-anatomy) and the textile cone's banded siphon; the conch is drawn without one.
  if (conch) {
    outside.position.copy(pivot)
    return outside
  }
  const siphonBase = cowrie
    ? new Vector3(front - L * 0.01, footTop * 1.3, mid)
    : new Vector3(front - L * 0.05, box.min.y + H * 0.3, mid)
  const siphonTip = cowrie
    ? siphonBase.clone().add(new Vector3(L * 0.08, footTop * 0.9, 0))
    : siphonBase.clone().add(new Vector3(L * 0.13, H * 0.42, -L * 0.02))
  const siphonPath = [
    siphonBase,
    siphonBase
      .clone()
      .lerp(siphonTip, 0.5)
      .add(new Vector3(L * 0.025, 0, 0)),
    siphonTip,
  ]
  const siphonRadius = L * (cowrie ? 0.017 : 0.02)
  if (skin.bands) {
    // Banded black and red (textile-cone-size-pattern): alternate short pieces along the siphon.
    const curve = new CatmullRomCurve3(siphonPath)
    const pieces = 8
    for (let i = 0; i < pieces; i++) {
      const a = curve.getPoint(i / pieces)
      const b = curve.getPoint((i + 0.5) / pieces)
      const c = curve.getPoint((i + 1) / pieces)
      const keep = 1 - 0.45 * (i / pieces)
      add(
        new Mesh(
          geo(limb([a, b, c], siphonRadius * keep, 0.95, 4)),
          skin.bands[i % 2]!,
        ),
      )
    }
    add(new Mesh(geo(cap(siphonTip, siphonRadius * 0.55)), skin.bands[1]!))
    add(marker('Banded siphon', siphonTip.clone()))
  } else {
    add(new Mesh(geo(limb(siphonPath, siphonRadius, 0.6, 18)), skin.flesh))
    if (cowrie) add(marker('Siphon', siphonTip.clone()))
  }
  outside.position.copy(pivot)
  return outside
}

/**
 * The nautilus: a leathery hood over the opening, a ring of many slender
 * tentacles (nautilus-appearance: more than 90, without suckers), a large eye
 * on each side, and the funnel below that it jets water from (nautilus-buoyancy).
 */
function nautilusBody(
  mouth: Vector3,
  ahead: Vector3,
  size: number,
  skin: BodyMaterials,
  own: Own,
) {
  const outside = new Group()
  const geo = <T extends BufferGeometry>(g: T) => own.geometry(g)
  const up = new Vector3(0, 1, 0)
  const side = new Vector3().crossVectors(ahead, up).normalize()
  const add = (part: Object3D) => {
    part.position.sub(mouth)
    outside.add(part)
  }
  const hood = new Mesh(
    geo(new SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.62)),
    skin.flesh,
  )
  hood.scale.set(size * 0.17, size * 0.11, size * 0.19)
  hood.position
    .copy(mouth)
    .addScaledVector(ahead, size * 0.03)
    .addScaledVector(up, size * 0.08)
  hood.quaternion.setFromUnitVectors(
    new Vector3(0, 1, 0),
    up.clone().addScaledVector(ahead, 0.35).normalize(),
  )
  add(hood)
  markMesh(hood, 'Hood')
  add(
    marker(
      'Tentacles',
      mouth
        .clone()
        .addScaledVector(ahead, size * 0.24)
        .addScaledVector(up, -size * 0.05),
    ),
  )
  const count = 92
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU * 3.1
    const ring = 0.35 + (0.65 * ((i * 37) % count)) / count
    const offset = side
      .clone()
      .multiplyScalar(Math.cos(angle) * size * 0.12 * ring)
      .addScaledVector(up, Math.sin(angle) * size * 0.09 * ring - size * 0.02)
    const from = mouth.clone().add(offset)
    const reach = size * (0.16 + 0.12 * (((i * 13) % 7) / 7))
    const droop = new Vector3(0, -size * (0.04 + 0.05 * ring), 0)
    const to = from
      .clone()
      .addScaledVector(ahead, reach)
      .add(offset.clone().multiplyScalar(0.5))
      .add(droop)
    const middle = from
      .clone()
      .lerp(to, 0.5)
      .add(droop.clone().multiplyScalar(0.3))
    add(
      new Mesh(
        geo(limb([from, middle, to], size * 0.0065, 0.35, 10)),
        skin.flesh,
      ),
    )
  }
  for (const sign of [-1, 1]) {
    const at = mouth
      .clone()
      .addScaledVector(side, sign * size * 0.16)
      .addScaledVector(up, size * 0.05)
      .addScaledVector(ahead, -size * 0.01)
    add(new Mesh(geo(cap(at, size * 0.04)), skin.eye))
    add(
      new Mesh(
        geo(
          cap(
            at.clone().addScaledVector(side, -sign * size * 0.012),
            size * 0.046,
          ),
        ),
        skin.flesh,
      ),
    )
  }
  const funnelFrom = mouth.clone().addScaledVector(up, -size * 0.1)
  add(
    new Mesh(
      geo(
        limb(
          [
            funnelFrom,
            funnelFrom
              .clone()
              .addScaledVector(ahead, size * 0.07)
              .addScaledVector(up, -size * 0.03),
            funnelFrom
              .clone()
              .addScaledVector(ahead, size * 0.12)
              .addScaledVector(up, -size * 0.02),
          ],
          size * 0.035,
          0.75,
          12,
        ),
      ),
      skin.flesh,
    ),
  )
  add(
    marker(
      'Funnel',
      funnelFrom
        .clone()
        .addScaledVector(ahead, size * 0.1)
        .addScaledVector(up, -size * 0.03),
    ),
  )
  outside.position.copy(mouth)
  return outside
}

/** A clutch of egg capsules on the floor, each with an embryo; returns how to frame them. */
function layEggs(
  group: Group,
  eggs: Mesh[],
  length: number,
  big: boolean,
  floor: number,
  own: Own,
): Built['close'] {
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
    if (i === 0) markMesh(egg, 'Egg capsule')
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
  return {
    target: new Vector3(0, eggSize, 0),
    width: spread * 1.4,
    height: spread,
  }
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
  const pearlKind =
    options.pearl != null &&
    frame.animal > 0 &&
    frame.larva === 0 &&
    !frame.beach
      ? pearlFor(species.id)
      : null
  // Looking for the pearl: the shell turns see-through, as it does for the X-ray view.
  const seeThrough = options.xray || Boolean(pearlKind)
  const shellMaterial = <T extends MeshStandardMaterial>(material: T) => {
    material.side = DoubleSide
    material.clippingPlanes = clipping
    if (seeThrough) {
      material.transparent = true
      material.opacity = 0.18
      material.depthWrite = false
    }
    return own.material(material)
  }
  const skin = skinMaterials(species.id, Math.max(0, frame.animal))
  for (const material of [
    skin.flesh,
    skin.sole,
    skin.eye,
    ...(skin.bands ?? []),
  ])
    own.material(material)
  const tissue = skin.flesh
  const wear = Math.round(frame.wear * 10) / 10
  let rig: Rig | null = null
  const eggs: Mesh[] = []
  let close: Built['close'] = null
  let bob = 0
  let larva: Velum | null = null
  const floor = 0

  if (frame.size > 0 && shape.kind === 'class') {
    // A bivalve, chiton, tusk shell or monoplacophoran, built whole and painted per vertex.
    const vertex = { vertexColors: true }
    const shellMat = shellMaterial(
      new MeshPhysicalMaterial({
        ...vertex,
        roughness: 0.45 + wear * 0.5,
        clearcoat: 0.25 * (1 - wear),
      }),
    )
    const innerMat = shellMaterial(
      new MeshStandardMaterial({ ...vertex, roughness: 0.25 }),
    )
    const tissueMat = own.material(
      new MeshPhysicalMaterial({
        ...vertex,
        roughness: 0.4,
        clearcoat: 0.4,
        sheen: 0.4,
        side: DoubleSide,
        transparent: frame.animal < 1,
        opacity: Math.max(0, frame.animal),
        clippingPlanes: clipping,
      }),
    )
    const whole = buildClassAnimal(
      shape.class,
      length,
      frame.size,
      frame.phase === 'adult' ? 1 : 0.5,
      own,
      { shell: shellMat, inner: innerMat, tissue: tissueMat },
    )
    const living = frame.animal > 0
    whole.body.visible = living
    whole.outside.visible = living
    if (pearlKind) {
      // The mantle and body go translucent too, so the pearl inside them shows.
      tissueMat.transparent = true
      tissueMat.opacity = Math.min(tissueMat.opacity, 0.32)
      tissueMat.depthWrite = false
    }
    // An empty tusk shell falls over and lies on its side; washed up, a clam lies on one valve.
    const lie =
      shape.class === 'tusk' && !living
        ? new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -0.8)
        : shape.class === 'clam' && frame.beach
          ? new Quaternion().setFromAxisAngle(
              new Vector3(1, 0, 0),
              -Math.PI / 2,
            )
          : null
    if (lie)
      for (const part of [whole.shell, whole.body, whole.outside])
        part.quaternion.copy(lie)
    specimen.add(whole.body, whole.shell, whole.outside)
    specimen.updateMatrixWorld(true)
    const box = new Box3().setFromObject(whole.shell)
    const centre = box.getCenter(new Vector3())
    const height = box.max.y - box.min.y
    // A tusk shell lives mostly buried, head down; empty shells lie on the sand.
    const sink = living && frame.larva === 0 ? whole.buried * height : 0
    for (const part of [whole.shell, whole.body, whole.outside])
      part.position.set(-centre.x, floor - box.min.y - sink, -centre.z)
    rig = {
      outside: whole.outside,
      shell: whole.shell,
      crab: new Group(),
      reach: adult.height * 1.3 + adult.length * 0.15,
    }
    if (pearlKind) {
      // Loose pearls grow in the mantle under the gape; a blister pearl against one valve's inside.
      const pearl = buildPearl(pearlKind, options.pearl!, own, {
        cut: options.cut,
        clipping,
      })
      const blister = pearl.step.blister
      pearl.group.position.set(
        0,
        floor - sink + height * (blister ? 0.42 : 0.8),
        blister ? -(box.max.z - box.min.z) * 0.12 : 0,
      )
      specimen.add(pearl.group)
      if (!blister) {
        const view = pearl.size * 7
        close = {
          target: pearl.group.position.clone(),
          width: view,
          height: view * 0.75,
        }
      }
    }
    if (frame.larva > 0) {
      specimen.updateMatrixWorld(true)
      const small = new Box3().setFromObject(specimen)
      const size = small.getSize(new Vector3())
      close = {
        target: small.getCenter(new Vector3()),
        width: Math.max(size.x, size.z) * 3,
        height: Math.max(size.y, size.x * 0.5) * 3.4,
      }
      bob = close.height * 0.03
    }
  } else if (frame.size > 0) {
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
        const soft = new Mesh(
          own.geometry(
            coilGeometry(built.coil, built.scale, built.end, {
              start,
              inset: built.wall + 0.12,
              detail: 0.6,
            }),
          ),
          tissue,
        )
        if (!swims) markMesh(soft, 'Visceral mass', true)
        body.add(soft)
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
        markMesh(cowrieBody.children[0] as Mesh, 'Mantle')
        cowrieBody.add(
          new Mesh(
            own.geometry(createShellGeometry(built.progress, 'inner')),
            tissue,
          ),
        )
        cowrieBody.children[cowrieBody.children.length - 1]!.scale.setScalar(
          0.94,
        )
        if (species.id === 'tiger-cowrie') {
          // Short papillae over the mantle lobes (cowrie-animal-anatomy), on the mantle's own surface.
          const progress = built.progress
          const limit = Math.PI - getShape(progress).opening
          const reach = (coverage / 100) * limit
          const mantleAt = (u: number, v: number) => {
            const side = v < 0.5 ? -1 : 1
            const theta =
              side * (limit - (v < 0.5 ? v * 2 : (v - 0.5) * 2) * reach)
            const uu = 0.08 + u * 0.84
            const p = shellPoint(uu, theta, progress, -0.04)
            const q = shellPoint(uu, theta, progress, 0.0)
            const point = new Vector3(p.x, p.y, p.z)
            return {
              point,
              normal: point
                .clone()
                .sub(new Vector3(q.x, q.y, q.z))
                .normalize(),
            }
          }
          for (const geometry of papillae(mantleAt, 150, 0.07, 41))
            cowrieBody.add(new Mesh(own.geometry(geometry), tissue))
        }
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
        markMesh(hole, 'Drill hole')
        built.group.add(hole)
      } else {
        for (let i = 0; i < 3; i++) {
          const nick = blob(
            [length * 0.03, length * 0.016, length * 0.02],
            own,
            markMaterial,
          )
          nick.position.copy(at(built.end, 0.3 + i * 0.35, -0.02))
          if (i === 1) markMesh(nick, 'Broken lip')
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
      markMesh(hole, 'Drill hole')
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
    else if (living) lift = footTop * 0.85
    else if (crabbed) lift = height * 0.18

    // Seat the shell: centred over the origin, resting on its foot, the sand, or in the water.
    const shift = new Vector3(-centre.x, floor + lift - box.min.y, -centre.z)
    if (built.coil && living && !swims) {
      // Seat a crawling snail by its opening: the opening rests on the foot, and anything lower
      // (a flared lip, the body whorl's flank) settles into the sand as it does in life.
      let openingLow = Infinity
      for (let i = 0; i < 24; i++) {
        const p = shell.localToWorld(
          new Vector3(
            ...toThree(
              coilPoint(built.coil, built.end - 0.25, (i / 24) * TAU, {
                inset: 0.4,
              }),
              built.scale,
            ),
          ),
        )
        openingLow = Math.min(openingLow, p.y)
      }
      const sink = Math.min(
        openingLow - box.min.y,
        (box.max.y - box.min.y) * 0.28,
      )
      shift.y = floor + footTop * 1.05 - box.min.y - sink
    }
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
      outside = nautilusBody(mouth, ahead, length * frame.size, skin, own)
    } else if (living && !swims) {
      // Where the opening is, in the specimen's frame: the body comes out of it.
      let opening: Vector3 | null = null
      if (built.coil) {
        const ring = Array.from({ length: 24 }, (_, i) =>
          shell.localToWorld(
            new Vector3(
              ...toThree(
                coilPoint(built.coil!, built.end - 0.25, (i / 24) * TAU, {
                  inset: 0.4,
                }),
                built.scale,
              ),
            ),
          ),
        )
        opening = ring
          .reduce((sum, p) => sum.add(p), new Vector3())
          .divideScalar(ring.length)
        opening.y = Math.max(opening.y, footTop)
      }
      outside = snailBody(
        seated,
        footTop,
        skin,
        own,
        species.id,
        underside(built.group, 12),
        opening,
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
        if (sign > 0) markMesh(claw, 'Hermit crab')
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
      // A larva is too small for the adult's part names: name the whole first shell instead.
      specimen.updateMatrixWorld(true)
      const named: Object3D[] = []
      let mouth: Vector3 | null = null
      specimen.traverse((part) => {
        if (!part.userData.label) return
        named.push(part)
        if (!mouth && /aperture/i.test(String(part.userData.label)))
          mouth = part.getWorldPosition(new Vector3())
      })
      named.forEach((part) => part.removeFromParent())
      // A swimming veliger hangs under its velum: turn the shell so its opening faces up.
      const middle = new Box3().setFromObject(specimen).getCenter(new Vector3())
      const out = mouth
        ? (mouth as Vector3).clone().sub(middle)
        : new Vector3(0, 1, 0)
      if (out.lengthSq() < 1e-9) out.set(0, 1, 0)
      const upright = new Quaternion().setFromUnitVectors(out.normalize(), UP)
      for (const child of [...specimen.children]) {
        child.position.sub(middle).applyQuaternion(upright).add(middle)
        child.quaternion.premultiply(upright)
      }
      specimen.updateMatrixWorld(true)
      const hung = new Box3().setFromObject(specimen)
      const hungSize = hung.getSize(new Vector3())
      specimen.add(marker('Larval shell', hung.getCenter(new Vector3())))
      const opening = mouth
        ? (mouth as Vector3)
            .clone()
            .sub(middle)
            .applyQuaternion(upright)
            .add(middle)
        : new Vector3(middle.x, hung.max.y, middle.z)
      opening.y = Math.max(opening.y, hung.max.y - hungSize.y * 0.2)
      const velum = buildVelum(
        Math.max(hungSize.x, hungSize.y, hungSize.z),
        own,
      )
      velum.group.position.copy(opening)
      specimen.add(velum.group)
      larva = velum
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

  if (frame.egg > 0) close = layEggs(group, eggs, length, swims, floor, own)

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
    velum: larva,
    dispose: own.dispose,
  }
}
