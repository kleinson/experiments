import {
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { limb } from './bodies.ts'
import type { Rgb } from './patterns.ts'
import { seeded } from './patterns.ts'
import type { Bed, Setting } from './seabed.ts'

/**
 * The seabed around the specimen: an illustrative diorama built from the
 * setting's mix of beds. Sizes are relative to the specimen (`extent`), so
 * the scenery is a setting, not a measured landscape.
 */
export type Scenery = {
  group: Group
  /** True when a ground plane is drawn (the specimen's own shadow falls on it). */
  ground: boolean
  /** True when something moves with the water. */
  animated: boolean
  sway: (seconds: number) => void
  dispose: () => void
}

const rgb = ([r, g, b]: Rgb) => new Color(r / 255, g / 255, b / 255)
const UP = new Vector3(0, 1, 0)
/** Horizontal direction toward the default camera: tall things stay out of this corridor. */
const TOWARD_VIEWER = new Vector2(260, 520).normalize()
/** How far the seabed reaches from the specimen; beyond it the water takes over. */
const REACH = 14

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

/** Sand with wind-and-wave ripples and grains, in the setting's ground colour. */
function groundTexture(colour: Rgb, ripples: number, own: Own) {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('The seabed could not be drawn.')
  const image = context.createImageData(size, size)
  const random = seeded(97)
  const TAU = Math.PI * 2
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      // Ripple crests bend and fork a little, as they do on real sand.
      const u = x / size
      const v = y / size
      const bend =
        Math.sin(u * TAU * 2 + Math.sin(v * TAU) * 1.3) * 0.045 +
        Math.sin(u * TAU * 5 + v * TAU * 3) * 0.012
      const crest = Math.sin((v + bend) * TAU * 7)
      const ridge = Math.pow(Math.max(0, crest), 3) - 0.35 * Math.max(0, -crest)
      const patch =
        0.06 * Math.sin(u * TAU * 3 + 1.2) * Math.cos(v * TAU * 2 + 0.4)
      const grain = (random() - 0.5) * 0.16
      const light = 1 + ridge * 0.16 * ripples + patch + grain
      const i = (y * size + x) * 4
      image.data[i] = Math.min(255, colour[0] * light)
      image.data[i + 1] = Math.min(255, colour[1] * light)
      image.data[i + 2] = Math.min(255, colour[2] * light)
      image.data[i + 3] = 255
    }
  context.putImageData(image, 0, 0)
  const map = own.texture(new CanvasTexture(canvas))
  map.colorSpace = SRGBColorSpace
  map.wrapS = map.wrapT = RepeatWrapping
  map.anisotropy = 8
  return map
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** A cylinder from `a` to `b`, tapering from `ra` to `rb`, with a round end. */
function segment(a: Vector3, b: Vector3, ra: number, rb: number) {
  const length = a.distanceTo(b)
  const geometry = new CylinderGeometry(rb, ra, length, 8, 1, false)
  geometry.translate(0, length / 2, 0)
  const q = new Quaternion().setFromUnitVectors(
    UP,
    b.clone().sub(a).normalize(),
  )
  geometry.applyMatrix4(new Matrix4().compose(a, q, new Vector3(1, 1, 1)))
  const tip = new SphereGeometry(rb, 8, 6)
  tip.translate(b.x, b.y, b.z)
  return [geometry, tip]
}

function merged(parts: BufferGeometry[], own: Own) {
  const geometry = mergeGeometries(parts, false)
  parts.forEach((part) => part.dispose())
  if (!geometry) throw new Error('Scenery geometry could not be merged.')
  return own.geometry(geometry)
}

export function buildSeafloor(
  setting: Setting,
  extent: number,
  seed: number,
): Scenery {
  const own = track()
  const group = new Group()
  group.name = 'seabed'
  const random = seeded(seed)
  const E = extent
  const swayers: { object: Object3D; phase: number; amount: number }[] = []
  let grass: {
    mesh: InstancedMesh
    items: { at: Vector3; yaw: number; height: number; phase: number }[]
  } | null = null
  let snow: { points: Points; base: Float32Array; top: number } | null = null
  const mix = setting.mix
  const weight = (bed: Bed) => mix[bed] ?? 0
  const between = (a: number, b: number) => a + (b - a) * random()
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)]!

  const standard = (colour: Rgb, roughness = 0.85, extra = {}) =>
    own.material(
      new MeshStandardMaterial({ color: rgb(colour), roughness, ...extra }),
    )

  /** Somewhere on the seabed between `near` and `far`; tall things keep `wide` clear of the line of sight. */
  const spot = (near: number, far: number, tall: boolean, wide = 0) => {
    for (let tries = 0; tries < 30; tries++) {
      const angle = random() * Math.PI * 2
      const r = Math.sqrt(between(near * near, far * far))
      const p = new Vector2(Math.cos(angle) * r, Math.sin(angle) * r)
      const along = p.dot(TOWARD_VIEWER)
      const across = Math.abs(p.x * TOWARD_VIEWER.y - p.y * TOWARD_VIEWER.x)
      if (tall && along > -E * 0.6 - wide && across < E * 1.7 + wide) continue
      return new Vector3(p.x, groundHeight(p.x, p.y), p.y)
    }
    return null
  }

  const deep = weight('deep') > 0.3
  /** The ground's height: flat around the specimen, gently rolling beyond, falling away on a slope. */
  const groundHeight = (x: number, z: number) => {
    const r = Math.hypot(x, z)
    const roll =
      (Math.sin(x / (E * 1.7)) * Math.cos(z / (E * 2.3)) +
        0.5 * Math.sin((x + z) / (E * 0.9))) *
      E *
      0.06 *
      smooth(E * 1.6, E * 5, r)
    const slope = deep ? Math.min(0, z + E * 2.2) * 0.35 : 0
    return roll + slope
  }

  if (setting.scene !== 'open-water') {
    const size = E * REACH * 2
    const geometry = new PlaneGeometry(size, size, 64, 64)
    geometry.rotateX(-Math.PI / 2)
    const position = geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++)
      position.setY(i, groundHeight(position.getX(i), position.getZ(i)))
    geometry.computeVertexNormals()
    const sandy =
      setting.scene === 'beach' ? 1 : weight('sand') + weight('seagrass') * 0.5
    const map = groundTexture(setting.ground, Math.min(1, sandy * 1.4), own)
    map.repeat.set(size / (E * 2.2), size / (E * 2.2))
    // The texture already carries the sand colour; it also lifts the ripples as relief.
    const ground = new Mesh(
      own.geometry(geometry),
      standard([255, 255, 255], 1, {
        map,
        bumpMap: map,
        bumpScale: 2.5,
        transparent: true,
      }),
    )
    // Only the ground fades out at its rim, so it alone needs blending.
    ;(ground.material as Material).userData.horizon = true
    ground.renderOrder = -1
    ground.receiveShadow = true
    ground.userData.ground = true
    ground.userData.inkGround = true
    group.add(ground)
  }

  // Coral heads: branching, brain, table, fan and soft corals in reef colours.
  // Living reef colours: mostly browns, ochres and olives from their algae, with a few purples and pinks.
  const coralColours: Rgb[] = [
    [150, 104, 70],
    [190, 140, 86],
    [128, 92, 128],
    [112, 128, 82],
    [204, 120, 96],
    [222, 182, 108],
    [176, 96, 116],
  ]
  const branch = (
    parts: BufferGeometry[],
    from: Vector3,
    dir: Vector3,
    length: number,
    radius: number,
    depth: number,
    flat: Vector3 | null,
  ) => {
    const to = from.clone().addScaledVector(dir, length)
    parts.push(...segment(from, to, radius, radius * 0.72))
    if (depth === 0) return
    const forks = depth > 2 ? 2 : random() > 0.4 ? 2 : 1
    for (let k = 0; k < forks; k++) {
      const turn = new Vector3(
        between(-1, 1),
        between(0.2, 0.8),
        between(-1, 1),
      )
      if (flat) turn.projectOnPlane(flat)
      const next = dir.clone().add(turn.multiplyScalar(0.7)).normalize()
      if (next.y < 0.15) next.y = 0.15
      branch(
        parts,
        to,
        next.normalize(),
        length * 0.78,
        radius * 0.72,
        depth - 1,
        flat,
      )
    }
  }
  const coral = (at: Vector3, scale: number) => {
    const kind = random()
    const colour = pick(coralColours)
    const material = standard(colour, 0.9)
    const holder = new Group()
    holder.position.copy(at)
    holder.rotation.y = random() * Math.PI * 2
    if (kind < 0.38) {
      const parts: BufferGeometry[] = []
      const stems = 3 + Math.floor(random() * 3)
      for (let s = 0; s < stems; s++) {
        const dir = new Vector3(
          between(-0.6, 0.6),
          1,
          between(-0.6, 0.6),
        ).normalize()
        branch(
          parts,
          new Vector3(
            between(-0.1, 0.1) * scale,
            0,
            between(-0.1, 0.1) * scale,
          ),
          dir,
          scale * 0.32,
          scale * 0.06,
          3,
          null,
        )
      }
      holder.add(new Mesh(merged(parts, own), material))
    } else if (kind < 0.62) {
      const geometry = new SphereGeometry(
        1,
        40,
        20,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.55,
      )
      const position = geometry.getAttribute('position')
      for (let i = 0; i < position.count; i++) {
        const p = new Vector3().fromBufferAttribute(position, i)
        const groove = Math.sin(p.x * 14 + Math.sin(p.z * 9) * 2) * 0.035
        p.multiplyScalar(1 + groove)
        position.setXYZ(i, p.x, p.y, p.z)
      }
      geometry.computeVertexNormals()
      geometry.scale(scale * 0.55, scale * 0.42, scale * 0.5)
      geometry.translate(0, -scale * 0.06, 0)
      holder.add(new Mesh(own.geometry(geometry), material))
    } else if (kind < 0.78) {
      const parts: BufferGeometry[] = [
        new CylinderGeometry(
          scale * 0.08,
          scale * 0.12,
          scale * 0.45,
          10,
        ).translate(0, scale * 0.22, 0),
        new CylinderGeometry(
          scale * 0.6,
          scale * 0.55,
          scale * 0.06,
          28,
        ).translate(0, scale * 0.47, 0),
      ]
      const mesh = new Mesh(merged(parts, own), material)
      mesh.rotation.z = between(-0.15, 0.15)
      holder.add(mesh)
    } else if (kind < 0.9) {
      const parts: BufferGeometry[] = []
      const plane = new Vector3(0, 0, 1)
      branch(
        parts,
        new Vector3(),
        new Vector3(0, 1, 0),
        scale * 0.3,
        scale * 0.025,
        5,
        plane,
      )
      const mesh = new Mesh(
        merged(parts, own),
        standard(
          pick([
            [170, 90, 150],
            [214, 96, 86],
            [236, 170, 90],
          ] as Rgb[]),
          0.9,
        ),
      )
      holder.add(mesh)
      swayers.push({ object: holder, phase: random() * 6, amount: 0.04 })
    } else {
      const parts: BufferGeometry[] = [
        new CylinderGeometry(
          scale * 0.12,
          scale * 0.16,
          scale * 0.2,
          14,
        ).translate(0, scale * 0.1, 0),
      ]
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2
        const base = new Vector3(
          Math.cos(a) * scale * 0.1,
          scale * 0.2,
          Math.sin(a) * scale * 0.1,
        )
        const tip = base
          .clone()
          .add(
            new Vector3(
              Math.cos(a) * scale * 0.2,
              scale * between(0.18, 0.3),
              Math.sin(a) * scale * 0.2,
            ),
          )
        parts.push(
          limb(
            [
              base,
              base
                .clone()
                .lerp(tip, 0.5)
                .add(new Vector3(0, scale * 0.05, 0)),
              tip,
            ],
            scale * 0.025,
            0.3,
            8,
          ),
        )
      }
      holder.add(
        new Mesh(
          merged(parts, own),
          standard(
            pick([
              [240, 170, 190],
              [180, 220, 190],
              [250, 200, 140],
            ] as Rgb[]),
            0.8,
          ),
        ),
      )
      swayers.push({ object: holder, phase: random() * 6, amount: 0.05 })
    }
    group.add(holder)
  }
  const corals = Math.round(
    22 * weight('coral') +
      4 * weight('deep') * (setting.scene === 'seabed' ? 1 : 0),
  )
  for (let i = 0; i < corals; i++) {
    const scale = E * between(0.7, 1.8)
    const at = spot(E * 1.15, E * 7, true, scale * 0.6)
    if (at) coral(at, scale)
  }

  // Rubble: broken, bleached coral branches and pebbles.
  const bits = Math.round(46 * weight('rubble'))
  if (bits) {
    const parts: BufferGeometry[] = []
    for (let i = 0; i < bits; i++) {
      const at = spot(E * 0.75, E * 6, false)
      if (!at) continue
      const length = E * between(0.12, 0.35)
      const dir = new Vector3(
        between(-1, 1),
        between(-0.1, 0.25),
        between(-1, 1),
      ).normalize()
      const start = at.clone().add(new Vector3(0, E * 0.02, 0))
      parts.push(
        ...segment(
          start,
          start.clone().addScaledVector(dir, length),
          E * 0.03,
          E * 0.022,
        ),
      )
    }
    if (parts.length) {
      const rubble = new Mesh(
        merged(parts, own),
        standard([230, 222, 206], 0.95),
      )
      // Small debris is drawn as tone only: outlines on tiny pieces read as ink blots.
      rubble.userData.inkGround = true
      group.add(rubble)
    }
  }

  // Pebbles and shell fragments on sand.
  const pebbles = Math.round(
    36 * (weight('sand') + weight('rubble') * 0.5 + weight('seagrass') * 0.3),
  )
  for (let i = 0; i < pebbles; i++) {
    const at = spot(E * 0.7, E * 6, false)
    if (!at) continue
    const r = E * between(0.025, 0.08)
    const shard = random() > 0.75
    const geometry = shard
      ? new SphereGeometry(
          r * 1.4,
          10,
          6,
          0,
          Math.PI * between(0.6, 1.2),
          0,
          Math.PI * 0.4,
        )
      : new SphereGeometry(r, 10, 8)
    const mesh = new Mesh(
      own.geometry(geometry),
      standard(
        shard
          ? [238, 226, 214]
          : pick([
              [176, 168, 156],
              [204, 196, 182],
              [140, 132, 124],
            ] as Rgb[]),
        0.9,
        { side: DoubleSide },
      ),
    )
    mesh.scale.set(1, shard ? 1 : 0.55, 1)
    mesh.position.copy(at).add(new Vector3(0, r * 0.25, 0))
    mesh.userData.inkGround = true
    mesh.rotation.set(
      shard ? Math.PI : 0,
      random() * 6,
      shard ? between(-0.3, 0.3) : 0,
    )
    group.add(mesh)
  }

  // Rocks: rounded boulders; dark and pitted on volcanic coasts, with a few urchins.
  const rocks = Math.round(16 * weight('rock') + (deep ? 6 : 0))
  const volcanic = setting.coast === 'volcanic'
  for (let i = 0; i < rocks; i++) {
    const r = E * between(0.35, 1.3)
    const at = spot(E * 1.2, E * 7, r > E * 0.3, r)
    if (!at) continue
    const geometry = new IcosahedronGeometry(1, 3)
    const position = geometry.getAttribute('position')
    const k = random() * 10
    for (let v = 0; v < position.count; v++) {
      const p = new Vector3().fromBufferAttribute(position, v)
      const bump =
        1 +
        0.12 * Math.sin(p.x * 3 + k) * Math.cos(p.z * 2.6 + k) +
        0.05 * Math.sin(p.y * 7 + k)
      p.multiplyScalar(bump)
      position.setXYZ(v, p.x, p.y, p.z)
    }
    geometry.computeVertexNormals()
    const mesh = new Mesh(
      own.geometry(geometry),
      standard(
        volcanic || deep
          ? pick([
              [84, 80, 78],
              [104, 98, 94],
            ] as Rgb[])
          : pick([
              [150, 144, 132],
              [170, 160, 140],
            ] as Rgb[]),
        0.95,
      ),
    )
    mesh.scale.set(r, r * between(0.45, 0.7), r * between(0.7, 1))
    mesh.position.copy(at).add(new Vector3(0, -r * 0.12, 0))
    mesh.rotation.y = random() * 6
    group.add(mesh)
    if ((volcanic || weight('rock') > 0.5) && random() > 0.55) {
      const parts: BufferGeometry[] = [new SphereGeometry(E * 0.08, 14, 10)]
      for (let s = 0; s < 40; s++) {
        const d = new Vector3(
          between(-1, 1),
          between(0, 1),
          between(-1, 1),
        ).normalize()
        parts.push(
          ...segment(
            d.clone().multiplyScalar(E * 0.07),
            d.clone().multiplyScalar(E * 0.22),
            E * 0.008,
            E * 0.002,
          ),
        )
      }
      const urchin = new Mesh(merged(parts, own), standard([70, 40, 72], 0.7))
      const top = at
        .clone()
        .add(
          new Vector3(between(-0.4, 0.4) * r, r * 0.45, between(-0.4, 0.4) * r),
        )
      urchin.position.copy(top)
      group.add(urchin)
    }
  }

  // Seagrass: many ribbon blades in patches, swaying together.
  const blades = Math.round(900 * weight('seagrass'))
  if (blades) {
    const geometry = new PlaneGeometry(E * 0.04, 1, 1, 6)
    geometry.translate(0, 0.5, 0)
    const position = geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i)
      position.setZ(i, y * y * E * 0.25)
    }
    geometry.computeVertexNormals()
    const material = standard([92, 146, 82], 0.8, { side: DoubleSide })
    const items: { at: Vector3; yaw: number; height: number; phase: number }[] =
      []
    const patches = Math.max(4, Math.round(16 * weight('seagrass')))
    for (let p = 0; p < patches && items.length < blades; p++) {
      const centre = spot(E * 1.0, E * 6.5, false)
      if (!centre) continue
      const reach = E * between(0.6, 1.4)
      const per = Math.ceil(blades / patches)
      for (let b = 0; b < per; b++) {
        const a = random() * Math.PI * 2
        const d = Math.sqrt(random()) * reach
        const x = centre.x + Math.cos(a) * d
        const z = centre.z + Math.sin(a) * d
        if (Math.hypot(x, z) < E * 0.8) continue
        const along = x * TOWARD_VIEWER.x + z * TOWARD_VIEWER.y
        const across = Math.abs(x * TOWARD_VIEWER.y - z * TOWARD_VIEWER.x)
        const low = along > -E * 0.4 || across < E * 1.6
        items.push({
          at: new Vector3(x, groundHeight(x, z), z),
          yaw: random() * Math.PI * 2,
          height: E * (low ? between(0.12, 0.28) : between(0.35, 0.9)),
          phase: random() * 6,
        })
      }
    }
    const mesh = new InstancedMesh(
      own.geometry(geometry),
      material,
      items.length,
    )
    const colour = new Color()
    items.forEach((_, i) => {
      colour.setRGB(
        between(0.32, 0.42),
        between(0.55, 0.66),
        between(0.28, 0.36),
      )
      mesh.setColorAt(i, colour)
    })
    mesh.castShadow = false
    group.add(mesh)
    grass = { mesh, items }
  }

  // Kelp and brown algae: tall stipes with blades and floats, and bushy Sargassum-like clumps.
  const plants = Math.round(22 * weight('kelp'))
  for (let i = 0; i < plants; i++) {
    const tall = random() > 0.45
    const height = E * (tall ? between(3, 7) : between(0.8, 1.8))
    const at = spot(E * 1.3, E * 8, true, E * 0.3)
    if (!at) continue
    const plant = new Group()
    plant.position.copy(at)
    const stipe: BufferGeometry[] = []
    const leaves: BufferGeometry[] = []
    const floats: BufferGeometry[] = []
    const stems = tall ? 1 : 4
    for (let s = 0; s < stems; s++) {
      const lean = new Vector3(
        between(-0.25, 0.25),
        1,
        between(-0.25, 0.25),
      ).normalize()
      const points = [0, 0.33, 0.66, 1].map((f) =>
        lean
          .clone()
          .multiplyScalar(height * f)
          .add(new Vector3(Math.sin(f * 3 + s) * E * 0.15, 0, 0)),
      )
      stipe.push(limb(points, E * (tall ? 0.03 : 0.018), 0.6, 16))
      const count = tall ? Math.floor(height / (E * 0.35)) : 10
      for (let k = 1; k < count; k++) {
        const f = k / count
        const base = points[0]!.clone().lerp(points[3]!, f)
        const length = E * (tall ? between(0.5, 0.9) : between(0.12, 0.22))
        const blade = new PlaneGeometry(
          length * (tall ? 0.28 : 0.4),
          length,
          1,
          4,
        )
        blade.translate(0, length / 2, 0)
        const bp = blade.getAttribute('position')
        for (let v = 0; v < bp.count; v++) {
          const y = bp.getY(v) / length
          bp.setX(
            v,
            bp.getX(v) * Math.sin(Math.PI * Math.min(1, y * 1.1 + 0.05)),
          )
          bp.setZ(v, y * y * length * 0.3)
        }
        blade.computeVertexNormals()
        const side = k % 2 ? 1 : -1
        blade.applyMatrix4(
          new Matrix4().compose(
            base,
            new Quaternion().setFromEuler(
              new Euler(0, (k * 2.4) % 6.28, side * 0.9),
            ),
            new Vector3(1, 1, 1),
          ),
        )
        leaves.push(blade)
        if (random() > 0.5) {
          const bladder = new SphereGeometry(E * (tall ? 0.05 : 0.025), 10, 8)
          bladder.translate(base.x + side * E * 0.06, base.y + E * 0.04, base.z)
          floats.push(bladder)
        }
      }
    }
    plant.add(new Mesh(merged(stipe, own), standard([118, 98, 46], 0.8)))
    plant.add(
      new Mesh(
        merged(leaves, own),
        standard(tall ? [132, 116, 52] : [150, 120, 50], 0.8, {
          side: DoubleSide,
        }),
      ),
    )
    if (floats.length)
      plant.add(new Mesh(merged(floats, own), standard([168, 140, 64], 0.6)))
    group.add(plant)
    swayers.push({
      object: plant,
      phase: random() * 6,
      amount: tall ? 0.05 : 0.08,
    })
  }

  // Deep slope: vase sponges and slender sea whips.
  if (deep && setting.scene === 'seabed') {
    for (let i = 0; i < 7; i++) {
      const scale = E * between(0.5, 1.2)
      const at = spot(E * 1.3, E * 6.5, true, scale * 0.4)
      if (!at) continue
      const profile = [0, 0.15, 0.4, 0.7, 1].map(
        (f) => new Vector2(scale * (0.12 + 0.28 * Math.pow(f, 1.4)), scale * f),
      )
      const vase = new Mesh(
        own.geometry(new LatheGeometry(profile, 24)),
        standard(
          pick([
            [214, 170, 104],
            [200, 132, 98],
            [228, 200, 150],
          ] as Rgb[]),
          0.9,
          { side: DoubleSide },
        ),
      )
      vase.position.copy(at)
      group.add(vase)
    }
    for (let i = 0; i < 9; i++) {
      const height = E * between(1.2, 2.8)
      const at = spot(E * 1.3, E * 7, true)
      if (!at) continue
      const whip = new Group()
      whip.position.copy(at)
      const bend = between(-0.4, 0.4)
      const points = [0, 0.4, 0.75, 1].map(
        (f) =>
          new Vector3(Math.sin(f * 2) * bend * height * 0.3, height * f, 0),
      )
      whip.add(
        new Mesh(
          own.geometry(limb(points, E * 0.022, 0.25, 16)),
          standard(
            pick([
              [214, 92, 70],
              [236, 150, 70],
              [190, 70, 110],
            ] as Rgb[]),
            0.8,
          ),
        ),
      )
      whip.rotation.y = random() * 6
      group.add(whip)
      swayers.push({ object: whip, phase: random() * 6, amount: 0.05 })
    }
  }

  // The beach: wet sand, the water's edge and its foam line.
  if (setting.scene === 'beach') {
    const shore = E * 2.4
    const wet = new Mesh(
      own.geometry(new PlaneGeometry(E * 1.2, E * 60).rotateX(-Math.PI / 2)),
      standard([150, 132, 104], 1, {
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    )
    wet.position.set(shore - E * 0.5, E * 0.004, 0)
    wet.userData.ground = true
    wet.userData.inkGround = true
    group.add(wet)
    const sea = new Mesh(
      own.geometry(new PlaneGeometry(E * 30, E * 60).rotateX(-Math.PI / 2)),
      standard([120, 180, 200], 0.2, {
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    )
    sea.position.set(shore + E * 15, E * 0.02, 0)
    sea.userData.ground = true
    sea.userData.inkGround = true
    group.add(sea)
    const foam: Vector3[] = []
    for (let k = 0; k <= 40; k++) {
      const z = -E * 12 + (k / 40) * E * 24
      foam.push(new Vector3(shore + Math.sin(z / E) * E * 0.15, E * 0.03, z))
    }
    const line = new Mesh(
      own.geometry(limb(foam, E * 0.03, 1, 120)),
      standard([250, 250, 246], 0.6),
    )
    line.userData.inkGround = true
    group.add(line)
    swayers.push({ object: line, phase: 0, amount: 0 })
  }

  // Drifting particles: marine snow in deep water, plankton in open water.
  if (deep || setting.scene === 'open-water') {
    const count = setting.scene === 'open-water' ? 500 : 320
    const base = new Float32Array(count * 3)
    const top = E * 4
    for (let i = 0; i < count; i++) {
      base[i * 3] = between(-1, 1) * E * 6
      base[i * 3 + 1] = between(-0.5, 1) * top
      base[i * 3 + 2] = between(-1, 1) * E * 6
    }
    const geometry = own.geometry(new BufferGeometry())
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(base.slice(), 3),
    )
    const points = new Points(
      geometry,
      own.material(
        new PointsMaterial({
          color: rgb(
            setting.scene === 'open-water' ? [214, 230, 220] : [236, 240, 244],
          ),
          size: 2.5,
          sizeAttenuation: false,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
        }),
      ),
    )
    points.userData.noInk = true
    points.frustumCulled = false
    group.add(points)
    snow = { points, base, top }
  }

  const matrix = new Matrix4()
  const q = new Quaternion()
  const euler = new Euler()
  const one = new Vector3(1, 1, 1)
  const sway = (t: number) => {
    for (const item of swayers) {
      if (item.amount === 0) {
        item.object.position.x = Math.sin(t * 0.5) * E * 0.25
        continue
      }
      item.object.rotation.x = Math.sin(t * 0.7 + item.phase) * item.amount
      item.object.rotation.z = Math.cos(t * 0.5 + item.phase) * item.amount
    }
    if (grass) {
      grass.items.forEach((item, i) => {
        const bend = Math.sin(t * 1.1 + item.phase + item.at.x / E) * 0.22
        euler.set(bend, item.yaw, bend * 0.4)
        q.setFromEuler(euler)
        matrix.compose(item.at, q, one.set(1, item.height, 1))
        grass!.mesh.setMatrixAt(i, matrix)
      })
      grass.mesh.instanceMatrix.needsUpdate = true
      grass.mesh.computeBoundingSphere()
    }
    if (snow) {
      const position = snow.points.geometry.getAttribute('position')
      const span = snow.top * 1.5
      for (let i = 0; i < position.count; i++) {
        const y0 = snow.base[i * 3 + 1]!
        let y = y0 - ((t * E * 0.05) % span)
        if (y < -snow.top * 0.5) y += span
        position.setXYZ(
          i,
          snow.base[i * 3]! + Math.sin(t * 0.3 + i) * E * 0.05,
          y,
          snow.base[i * 3 + 2]!,
        )
      }
      position.needsUpdate = true
    }
  }
  sway(0)

  return {
    group,
    ground: setting.scene !== 'open-water',
    animated: swayers.length > 0 || grass !== null || snow !== null,
    sway,
    dispose: own.dispose,
  }
}
