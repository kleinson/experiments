import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Euler,
  Vector3,
} from 'three'
import type { Material } from 'three'
import { linear } from './kit.ts'
import type { Rgb } from './patterns.ts'
import type { Reef } from './places.ts'

/**
 * Reef fish drawn as familiar kinds, not particular species: small schooling
 * damselfish and anthias, butterflyfish, surgeonfish, parrotfish, wrasse,
 * sergeant majors, grunts, breams, goatfish and clownfish. Each kind is one
 * instanced mesh whose tail beats in the vertex shader, so dozens of fish
 * cost a few draw calls. Behaviour is simple and cheap: schools follow a
 * leader, grazers swim from coral to coral and peck, goatfish root in the
 * sand with their chins, clownfish stay close to their anemone.
 */
export type FishKind =
  | 'chromis'
  | 'anthias'
  | 'butterfly'
  | 'tang'
  | 'blueTang'
  | 'parrot'
  | 'wrasse'
  | 'sergeant'
  | 'grunt'
  | 'bream'
  | 'damsel'
  | 'goatfish'
  | 'clown'

type Shape = {
  /** Body depth and thickness, relative to its length. */
  depth: number
  width: number
  /** Where along the body it is deepest (0 tail … 1 snout). */
  peak: number
  /** Tail: forked, lyre or square. */
  tail: 'forked' | 'lyre' | 'square'
  /**
   * A typical adult's total length in millimetres (FishBase common lengths, well under each
   * kind's maximum), so fish, coral and shells share one real scale; and how fast it beats its tail.
   */
  mm: number
  beat: number
  paint: (x: number, y: number, out: Color) => void
}

const c = (rgb: Rgb) => linear(rgb)
const mixInto = (out: Color, a: Color, b: Color, t: number) =>
  out.copy(a).lerp(b, Math.min(1, Math.max(0, t)))
const band = (x: number, at: number, half: number) =>
  Math.abs(x - at) < half ? 1 : 0
const eye = (x: number, y: number) => Math.hypot(x - 0.72, y - 0.06) < 0.06

const SHAPES: Record<FishKind, Shape> = {
  chromis: {
    depth: 0.36,
    width: 0.15,
    peak: 0.55,
    tail: 'forked',
    mm: 80,
    beat: 13,
    paint: (x, y, o) =>
      eye(x, y)
        ? o.copy(c([20, 20, 30]))
        : mixInto(o, c([90, 200, 190]), c([40, 120, 170]), y * 3 + 0.5),
  },
  anthias: {
    depth: 0.34,
    width: 0.14,
    peak: 0.55,
    tail: 'lyre',
    mm: 90,
    beat: 13,
    paint: (x, y, o) =>
      eye(x, y)
        ? o.copy(c([20, 20, 30]))
        : Math.abs(y + 0.02 - (x - 0.6) * 0.3) < 0.02 && x > 0.55
          ? o.copy(c([180, 120, 230]))
          : mixInto(o, c([250, 150, 110]), c([240, 110, 140]), y * 2 + 0.5),
  },
  butterfly: {
    depth: 0.78,
    width: 0.12,
    peak: 0.45,
    tail: 'square',
    mm: 130,
    beat: 9,
    paint: (x, y, o) => {
      if (eye(x, y)) return o.copy(c([10, 10, 10]))
      if (band(x, 0.72, 0.06) && y > -0.25) return o.copy(c([20, 20, 24]))
      if (x < -0.45) return o.copy(c([250, 220, 60]))
      const dot = Math.hypot(x + 0.3, y - 0.12) < 0.08
      return dot
        ? o.copy(c([30, 30, 30]))
        : mixInto(o, c([250, 250, 244]), c([250, 214, 70]), -x + 0.2)
    },
  },
  tang: {
    depth: 0.72,
    width: 0.12,
    peak: 0.45,
    tail: 'square',
    mm: 150,
    beat: 9,
    paint: (x, y, o) =>
      eye(x, y)
        ? o.copy(c([20, 20, 20]))
        : Math.hypot(x + 0.62, y) < 0.04
          ? o.copy(c([250, 250, 250]))
          : o.copy(c([252, 218, 40])),
  },
  blueTang: {
    depth: 0.6,
    width: 0.13,
    peak: 0.45,
    tail: 'square',
    mm: 200,
    beat: 9,
    paint: (x, y, o) =>
      eye(x, y)
        ? o.copy(c([10, 10, 20]))
        : x < -0.65
          ? o.copy(c([250, 210, 50]))
          : Math.abs(y - 0.12 - Math.sin(x * 3) * 0.05) < 0.04 && x > -0.5
            ? o.copy(c([20, 20, 50]))
            : o.copy(c([40, 90, 210])),
  },
  parrot: {
    depth: 0.4,
    width: 0.2,
    peak: 0.55,
    tail: 'square',
    mm: 350,
    beat: 7,
    paint: (x, y, o) => {
      if (eye(x, y)) return o.copy(c([200, 120, 40]))
      if (x > 0.88) return o.copy(c([230, 230, 210]))
      const scale = Math.sin(x * 40) * Math.sin(y * 40) > 0.6
      return mixInto(
        o,
        c([40, 180, 160]),
        c([80, 110, 210]),
        y * 2 + 0.5,
      ).multiplyScalar(scale ? 1.2 : 1)
    },
  },
  wrasse: {
    depth: 0.24,
    width: 0.11,
    peak: 0.6,
    tail: 'square',
    mm: 110,
    beat: 12,
    paint: (x, y, o) =>
      eye(x, y)
        ? o.copy(c([20, 20, 20]))
        : Math.abs(y) < 0.03 + (0.4 - x) * 0.03
          ? o.copy(c([20, 20, 30]))
          : mixInto(o, c([250, 250, 240]), c([60, 140, 230]), (0.5 - x) * 1.4),
  },
  sergeant: {
    depth: 0.5,
    width: 0.13,
    peak: 0.5,
    tail: 'forked',
    mm: 150,
    beat: 11,
    paint: (x, y, o) => {
      if (eye(x, y)) return o.copy(c([20, 20, 20]))
      for (const at of [-0.45, -0.15, 0.15, 0.45])
        if (band(x, at, 0.05)) return o.copy(c([30, 30, 34]))
      return mixInto(o, c([240, 240, 230]), c([240, 220, 90]), y * 3)
    },
  },
  grunt: {
    depth: 0.42,
    width: 0.15,
    peak: 0.55,
    tail: 'forked',
    mm: 200,
    beat: 10,
    paint: (x, y, o) =>
      eye(x, y)
        ? o.copy(c([20, 20, 20]))
        : Math.sin(y * 70 + x * 6) > 0.55
          ? o.copy(c([70, 140, 220]))
          : o.copy(c([250, 214, 60])),
  },
  bream: {
    depth: 0.5,
    width: 0.14,
    peak: 0.5,
    tail: 'forked',
    mm: 250,
    beat: 9,
    paint: (x, y, o) =>
      eye(x, y)
        ? o.copy(c([20, 20, 20]))
        : band(x, -0.55, 0.06)
          ? o.copy(c([30, 30, 34]))
          : band(x, 0.5, 0.03) || band(x, 0.1, 0.03)
            ? o.copy(c([150, 155, 160]))
            : mixInto(o, c([230, 232, 236]), c([150, 160, 170]), y * 2.5),
  },
  damsel: {
    depth: 0.44,
    width: 0.14,
    peak: 0.5,
    tail: 'forked',
    mm: 90,
    beat: 13,
    paint: (x, y, o) =>
      eye(x, y) ? o.copy(c([10, 10, 10])) : o.copy(c([70, 60, 56])),
  },
  goatfish: {
    depth: 0.26,
    width: 0.14,
    peak: 0.6,
    tail: 'forked',
    mm: 250,
    beat: 8,
    paint: (x, y, o) =>
      eye(x, y)
        ? o.copy(c([20, 20, 20]))
        : Math.abs(y - 0.02) < 0.035
          ? o.copy(c([250, 214, 50]))
          : mixInto(o, c([250, 246, 236]), c([200, 210, 220]), y * 3),
  },
  clown: {
    depth: 0.46,
    width: 0.16,
    peak: 0.55,
    tail: 'square',
    mm: 75,
    beat: 14,
    paint: (x, y, o) => {
      if (eye(x, y)) return o.copy(c([20, 20, 20]))
      for (const at of [0.55, 0.05, -0.62]) {
        if (band(x, at, 0.07)) return o.copy(c([252, 252, 248]))
        if (band(x, at, 0.095)) return o.copy(c([20, 20, 20]))
      }
      return o.copy(c([250, 120, 30]))
    },
  },
}

/** Which kinds swim where, and how many; illustrative of each kind of reef. */
const COMMUNITIES: Partial<Record<Reef, [FishKind, number][]>> = {
  'red-sea': [
    ['anthias', 22],
    ['butterfly', 3],
    ['sergeant', 4],
    ['parrot', 2],
    ['clown', 2],
    ['wrasse', 2],
    ['goatfish', 2],
  ],
  'coral-triangle': [
    ['chromis', 20],
    ['anthias', 10],
    ['butterfly', 3],
    ['blueTang', 2],
    ['parrot', 2],
    ['clown', 2],
    ['wrasse', 2],
    ['goatfish', 2],
  ],
  'indo-pacific': [
    ['chromis', 18],
    ['butterfly', 3],
    ['blueTang', 2],
    ['parrot', 2],
    ['clown', 2],
    ['wrasse', 2],
    ['goatfish', 2],
  ],
  atoll: [
    ['chromis', 18],
    ['butterfly', 3],
    ['parrot', 2],
    ['sergeant', 3],
    ['wrasse', 2],
    ['goatfish', 3],
  ],
  granite: [
    ['chromis', 16],
    ['butterfly', 2],
    ['parrot', 2],
    ['sergeant', 3],
    ['clown', 2],
    ['goatfish', 2],
  ],
  volcanic: [
    ['tang', 8],
    ['butterfly', 3],
    ['sergeant', 4],
    ['wrasse', 2],
    ['parrot', 1],
    ['goatfish', 3],
  ],
  caribbean: [
    ['grunt', 14],
    ['sergeant', 5],
    ['blueTang', 3],
    ['parrot', 2],
    ['butterfly', 2],
    ['wrasse', 3],
    ['goatfish', 2],
  ],
  'caribbean-seagrass': [
    ['grunt', 12],
    ['parrot', 2],
    ['sergeant', 3],
    ['goatfish', 3],
  ],
  'pink-sand': [
    ['grunt', 12],
    ['sergeant', 4],
    ['blueTang', 3],
    ['parrot', 2],
    ['wrasse', 2],
  ],
  'rocky-algae': [
    ['grunt', 12],
    ['sergeant', 6],
    ['parrot', 1],
    ['wrasse', 2],
    ['goatfish', 2],
  ],
  posidonia: [
    ['damsel', 18],
    ['bream', 5],
    ['wrasse', 2],
  ],
  'shallow-gulf': [
    ['sergeant', 6],
    ['bream', 5],
    ['butterfly', 2],
    ['goatfish', 2],
  ],
}

/** Builds a fish along +x (snout at +1, tail fin at −1.05), with fins and painted colours. */
function fishGeometry(kind: FishKind) {
  const shape = SHAPES[kind]
  const positions: number[] = []
  const colours: number[] = []
  const index: number[] = []
  const colour = new Color()
  const push = (x: number, y: number, z: number) => {
    positions.push(x, y, z)
    shape.paint(x, y, colour)
    colours.push(colour.r, colour.g, colour.b)
    return positions.length / 3 - 1
  }
  // Body: rings along the length, an ellipse in cross-section.
  const rings = 22
  const around = 12
  const from = -0.72
  const half = (x: number) => {
    const t = (x - from) / (1 - from)
    const rise =
      t < shape.peak
        ? Math.sin((t / shape.peak) * Math.PI * 0.5)
        : Math.cos(((t - shape.peak) / (1 - shape.peak)) * Math.PI * 0.5)
    return Math.max(0.05, Math.pow(Math.max(0, rise), 0.75))
  }
  for (let i = 0; i <= rings; i++) {
    const x = from + ((1 - from) * i) / rings
    const h = (half(x) * shape.depth) / 2
    const w = (half(x) * shape.width) / 2
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2
      push(x, Math.sin(a) * h, Math.cos(a) * w)
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < around; j++) {
      const a = i * around + j
      const b = i * around + ((j + 1) % around)
      index.push(a, b, a + around, b, b + around, a + around)
    }
  const fin = (points: [number, number][]) => {
    const ids = points.map(([x, y]) => push(x, y, 0))
    for (let k = 1; k < ids.length - 1; k++)
      index.push(ids[0]!, ids[k]!, ids[k + 1]!)
  }
  const peduncle = (shape.depth * 0.05) / 2 + 0.02
  const t = shape.depth * 0.55
  if (shape.tail === 'forked')
    fin([
      [from + 0.02, 0],
      [from, peduncle],
      [-1.05, t],
      [-0.9, 0],
      [-1.05, -t],
      [from, -peduncle],
    ])
  else if (shape.tail === 'lyre')
    fin([
      [from + 0.02, 0],
      [from, peduncle],
      [-1.12, t * 1.1],
      [-0.88, 0],
      [-1.12, -t * 1.1],
      [from, -peduncle],
    ])
  else
    fin([
      [from + 0.02, 0],
      [from, peduncle],
      [-0.98, t * 0.8],
      [-1.0, 0],
      [-0.98, -t * 0.8],
      [from, -peduncle],
    ])
  const top = shape.depth / 2
  // Dorsal and anal fins along the back and belly.
  fin([
    [0.35, top * 0.95],
    [-0.55, top * 0.45],
    [-0.45, top * 1.3],
    [0.1, top * 1.35],
  ])
  fin([
    [-0.05, -top * 0.9],
    [-0.55, -top * 0.45],
    [-0.45, -top * 1.2],
  ])
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return geometry
}

export const fishClock = { value: 0 }

/** The tail beat: each fish bends behind its head, more towards the tail, at its own pace. */
function swimming(material: Material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.fishTime = fishClock
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec3 aBeat;\nuniform float fishTime;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float behind = clamp((0.45 - position.x) / 1.5, 0.0, 1.0);
          transformed.z += sin(aBeat.x - position.x * 3.0) * aBeat.z * behind * behind;
          transformed.z -= sin(aBeat.x) * aBeat.z * 0.12 * step(0.5, position.x);
        }`,
      )
  }
  material.customProgramCacheKey = () => 'fish'
  return material
}

type Fish = {
  kind: FishKind
  mesh: InstancedMesh
  slot: number
  pos: Vector3
  vel: Vector3
  size: number
  phase: number
  beatRate: number
  mode: 'school' | 'graze' | 'root' | 'home'
  target: Vector3
  /** Seconds left feeding at the target, or 0 while travelling. */
  feeding: number
  offset: Vector3
  home: Vector3 | null
}

export type FishLife = {
  meshes: InstancedMesh[]
  animate: (t: number, avoid: Vector3) => void
  dispose: () => void
}

/**
 * The fish of one setting, in millimetres; `E` lays out their range (at least 30 cm). `feed` are coral and rock tops grazers visit,
 * `sand` open spots goatfish root in, `homes` anemones for clownfish.
 */
export function buildFish(
  reef: Reef,
  E: number,
  random: () => number,
  feed: Vector3[],
  sand: Vector3[],
  homes: Vector3[],
  scale = 1,
): FishLife {
  const community = COMMUNITIES[reef] ?? COMMUNITIES['indo-pacific']!
  const meshes: InstancedMesh[] = []
  const materials: Material[] = []
  const fish: Fish[] = []
  const between = (a: number, b: number) => a + (b - a) * random()
  const schoolCentre = new Vector3(-E * 2.5, E * 2.2, -E * 3)
  const pickFeed = () =>
    feed.length
      ? feed[Math.floor(random() * feed.length)]!.clone()
      : new Vector3(between(-4, 4) * E, E * 0.5, between(-6, -2) * E)
  const pickSand = () =>
    sand.length
      ? sand[Math.floor(random() * sand.length)]!.clone()
      : new Vector3(between(-4, 4) * E, 0, between(-5, -1) * E)
  for (const [kind, wanted] of community) {
    const count =
      kind === 'clown'
        ? homes.length
          ? Math.min(wanted, homes.length * 2)
          : 0
        : Math.max(1, Math.round(wanted * scale))
    if (!count) continue
    const shape = SHAPES[kind]
    const geometry = fishGeometry(kind)
    const material = swimming(
      new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.45,
        metalness: 0.05,
        side: DoubleSide,
      }),
    )
    materials.push(material)
    const mesh = new InstancedMesh(geometry, material, count)
    mesh.frustumCulled = false
    mesh.userData.fish = true
    mesh.userData.noInk = true
    const beats = new Float32Array(count * 3)
    mesh.geometry.setAttribute('aBeat', new InstancedBufferAttribute(beats, 3))
    meshes.push(mesh)
    const schooling =
      kind === 'chromis' ||
      kind === 'anthias' ||
      kind === 'grunt' ||
      kind === 'damsel' ||
      (kind === 'tang' && count > 4)
    for (let i = 0; i < count; i++) {
      const size = shape.mm * between(0.75, 1.05)
      const mode: Fish['mode'] =
        kind === 'clown'
          ? 'home'
          : kind === 'goatfish'
            ? 'root'
            : schooling
              ? 'school'
              : 'graze'
      const home =
        mode === 'home'
          ? homes[Math.floor(i / 2) % homes.length]!.clone()
          : null
      const start =
        mode === 'school'
          ? schoolCentre
              .clone()
              .add(
                new Vector3(
                  between(-1, 1),
                  between(-0.4, 0.4),
                  between(-1, 1),
                ).multiplyScalar(E),
              )
          : home
            ? home.clone().add(new Vector3(0, E * 0.15, 0))
            : mode === 'root'
              ? pickSand().add(new Vector3(0, E * 0.1, 0))
              : pickFeed().add(new Vector3(0, E * 0.6, 0))
      fish.push({
        kind,
        mesh,
        slot: i,
        pos: start,
        vel: new Vector3(between(-1, 1), 0, between(-1, 1)).setLength(E * 0.3),
        size,
        phase: random() * 100,
        beatRate: shape.beat * between(0.85, 1.15),
        mode,
        target: mode === 'root' ? pickSand() : pickFeed(),
        feeding: 0,
        offset: new Vector3(
          between(-1, 1),
          between(-0.5, 0.5),
          between(-1, 1),
        ).multiplyScalar(E * (kind === 'grunt' ? 0.6 : 0.9)),
        home,
      })
    }
  }

  const matrix = new Matrix4()
  const q = new Quaternion()
  const euler = new Euler(0, 0, 0, 'YZX')
  const scaleV = new Vector3()
  const desired = new Vector3()
  const leader = new Vector3()
  const leaderVel = new Vector3()
  let last = 0
  const animate = (t: number, avoid: Vector3) => {
    const dt = Math.min(0.1, Math.max(0, t - last))
    last = t
    // The school's leader follows a slow, wandering loop around the far side of the reef.
    const a = t * 0.12
    leader.set(
      schoolCentre.x + Math.cos(a) * E * 3.2,
      schoolCentre.y + Math.sin(a * 2.3) * E * 0.5,
      schoolCentre.z + Math.sin(a) * E * 2,
    )
    leaderVel.set(
      -Math.sin(a) * E * 3.2 * 0.12,
      Math.cos(a * 2.3) * E * 0.5 * 0.28,
      Math.cos(a) * E * 2 * 0.12,
    )
    for (const f of fish) {
      let speed = E * 0.5
      let pitch = 0
      let beat = 1
      if (f.mode === 'school') {
        // Each keeps its place in the school, turned with the leader, and drifts within it.
        const yaw = Math.atan2(-leaderVel.z, leaderVel.x)
        desired
          .copy(f.offset)
          .applyAxisAngle(new Vector3(0, 1, 0), yaw)
          .add(leader)
        desired.y += Math.sin(t * 0.7 + f.phase) * E * 0.08
        desired.sub(f.pos).multiplyScalar(1.6).add(leaderVel)
        speed = E * 0.9
      } else if (f.mode === 'home') {
        // Clownfish dart about just above their anemone and never stray far.
        if (f.feeding <= 0 || f.pos.distanceTo(f.target) < E * 0.05) {
          f.target
            .copy(f.home!)
            .add(
              new Vector3(
                between(-1, 1) * E * 0.25,
                E * between(0.1, 0.35),
                between(-1, 1) * E * 0.25,
              ),
            )
          f.feeding = between(0.6, 1.6)
        }
        f.feeding -= dt
        desired.copy(f.target).sub(f.pos).multiplyScalar(2.2)
        speed = E * 0.35
      } else {
        // Grazers and goatfish: swim to a feeding spot, feed there a while, then move on.
        const hover =
          f.mode === 'root' ? E * 0.06 + f.size * 0.2 : E * 0.08 + f.size * 0.35
        const there = f.target.clone().add(new Vector3(0, hover, 0))
        const dist = f.pos.distanceTo(there)
        if (f.feeding > 0) {
          f.feeding -= dt
          // Feeding: nose down to the coral or sand, small pecks forward, a slow tail.
          desired.copy(there).sub(f.pos).multiplyScalar(1.5)
          desired.y += Math.sin(t * 6 + f.phase) * E * 0.04
          pitch = f.mode === 'root' ? -0.55 : -0.35
          beat = 0.35
          speed = E * 0.12
          if (f.feeding <= 0) {
            f.target = f.mode === 'root' ? pickSand() : pickFeed()
          }
        } else {
          desired.copy(there).sub(f.pos)
          if (dist < E * 0.15) f.feeding = between(2.5, 6)
          desired.setLength(Math.min(E * 0.55, dist * 1.2))
          speed = E * 0.55
        }
      }
      // Keep clear of the specimen and the camera's subject.
      const away = f.pos.clone().sub(avoid)
      away.y *= 0.5
      const close = away.length()
      if (close < E * 1.4 && f.mode !== 'home')
        desired.addScaledVector(away.normalize(), (E * 1.4 - close) * 2.5)
      if (desired.length() > speed) desired.setLength(speed)
      // Turn smoothly towards where it wants to go.
      f.vel.lerp(desired, Math.min(1, dt * 2.2))
      f.pos.addScaledVector(f.vel, dt)
      if (f.pos.y < E * 0.04) f.pos.y = E * 0.04
      const v = f.vel
      const flat = Math.hypot(v.x, v.z)
      if (flat > 1e-5) euler.y = Math.atan2(-v.z, v.x)
      euler.z =
        pitch !== 0 ? pitch : Math.atan2(v.y, Math.max(flat, 1e-5)) * 0.6
      q.setFromEuler(euler)
      scaleV.setScalar(f.size / 2)
      matrix.compose(f.pos, q, scaleV)
      f.mesh.setMatrixAt(f.slot, matrix)
      // Tail beat: faster when swimming hard, slow while feeding.
      const pace = Math.min(1.6, 0.4 + v.length() / (E * 0.5))
      f.phase += dt * f.beatRate * pace * beat
      const beats = f.mesh.geometry.getAttribute(
        'aBeat',
      ) as InstancedBufferAttribute
      beats.setXYZ(f.slot, f.phase, 0, 0.12 * Math.min(1.3, pace))
    }
    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true
      mesh.geometry.getAttribute('aBeat').needsUpdate = true
    }
    fishClock.value = t
  }
  animate(0, new Vector3())
  return {
    meshes,
    animate,
    dispose() {
      meshes.forEach((mesh) => mesh.geometry.dispose())
      materials.forEach((material) => material.dispose())
    },
  }
}
