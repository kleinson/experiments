import {
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshPhysicalMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import type { Material } from 'three'
import { marker, markMesh } from './labels.ts'
import type { Rgb } from './patterns.ts'

type Own = {
  geometry<T extends BufferGeometry>(value: T): T
  material<T extends Material>(value: T): T
}

export type Velum = {
  /** Head and both lobes, rooted at the shell's opening (its origin). */
  group: Group
  /** Moves the cilia for a moment in time, in seconds. */
  beat: (t: number) => void
}

const rgb = ([r, g, b]: Rgb) => (r << 16) | (g << 8) | b

/** How far each lobe's centre sits from the middle, in lobe radii. */
const APART = 0.78
/** Lobes are a little longer side to side than front to back. */
const DEPTH = 0.82
/** Half the angle of each lobe's rim hidden where it meets the other lobe. */
const JOIN = Math.acos(APART)

/**
 * A veliger's velum: two thin, wing-like lobes on a short head that rises out
 * of the shell's opening, each rimmed by a band of long cilia (the prototroch)
 * with a band of shorter cilia (the metatroch) just inside it. The long cilia
 * beat in waves that run around the rim; the short ones beat the other way,
 * towards them, and the food groove lies between the two. Sizes are
 * illustrative, scaled to the larval shell (`span`, its longest side).
 */
export function buildVelum(span: number, own: Own): Velum {
  const group = new Group()
  const R = span * 0.62
  const neck = span * 0.16
  const cup = R * 0.16
  const skin = own.material(
    new MeshPhysicalMaterial({
      color: rgb([238, 226, 210]),
      roughness: 0.45,
      transparent: true,
      opacity: 0.62,
      side: DoubleSide,
      depthWrite: false,
      sheen: 0.6,
    }),
  )
  const band = own.material(
    new MeshPhysicalMaterial({
      color: rgb([214, 178, 146]),
      roughness: 0.55,
      sheen: 0.4,
    }),
  )
  const head = own.material(
    new MeshPhysicalMaterial({
      color: rgb([232, 214, 194]),
      roughness: 0.5,
      transparent: true,
      opacity: 0.9,
      sheen: 0.5,
    }),
  )

  // The head: a short neck out of the opening and a rounded crown the lobes spring from.
  const neckMesh = new Mesh(
    own.geometry(
      new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(0, -neck * 0.2, 0),
          new Vector3(0, neck * 0.5, 0),
          new Vector3(0, neck, 0),
        ]),
        12,
        span * 0.075,
        12,
        false,
      ),
    ),
    head,
  )
  const crown = new Mesh(own.geometry(new SphereGeometry(1, 24, 16)), head)
  crown.scale.set(span * 0.13, span * 0.07, span * 0.1)
  crown.position.set(0, neck, 0)
  group.add(neckMesh, crown)

  /** A point on a lobe's surface, `r` lobe radii out at angle `a`. */
  const onLobe = (side: number, a: number, r: number, drop = 0) =>
    new Vector3(
      side * R * APART + Math.cos(a) * R * r,
      neck + cup * r * r - drop,
      Math.sin(a) * R * r * DEPTH,
    )

  type Cilium = {
    root: Vector3
    out: Vector3
    length: number
    u: number
    long: boolean
  }
  const cilia: Cilium[] = []
  for (const side of [-1, 1]) {
    // The lobe: a thin disc, cupped so its rim turns up a little.
    const disc = new CircleGeometry(R, 64)
    disc.rotateX(-Math.PI / 2)
    const position = disc.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      const z = position.getZ(i) * DEPTH
      const r = Math.hypot(x, z * (1 / DEPTH)) / R
      position.setXYZ(i, x + side * R * APART, neck + cup * r * r, z)
    }
    disc.computeVertexNormals()
    const lobe = new Mesh(own.geometry(disc), skin)
    if (side > 0) markMesh(lobe, 'Velum')
    group.add(lobe)

    // Only the outer rim is free: where the lobes meet, the bands run on across the head.
    const inward = side > 0 ? Math.PI : 0
    const from = inward + JOIN
    const to = inward + Math.PI * 2 - JOIN
    const arc = (r: number, drop: number, steps: number) =>
      Array.from({ length: steps + 1 }, (_, k) =>
        onLobe(side, from + ((to - from) * k) / steps, r, drop),
      )
    for (const [r, drop, thick] of [
      [1, 0, R * 0.032],
      [0.86, R * 0.025, R * 0.018],
    ] as const)
      group.add(
        new Mesh(
          own.geometry(
            new TubeGeometry(
              new CatmullRomCurve3(arc(r, drop, 48)),
              96,
              thick,
              6,
              false,
            ),
          ),
          band,
        ),
      )
    const count = 84
    for (let k = 0; k < count; k++) {
      const u = (k + 0.5) / count
      const a = from + (to - from) * u
      const out = new Vector3(Math.cos(a), 0, Math.sin(a) * DEPTH).normalize()
      // Number the cilia all the way round both lobes, so the waves run on from one to the other.
      const around = side > 0 ? u : 2 - u
      cilia.push({
        root: onLobe(side, a, 1),
        out,
        length: R * 0.2,
        u: around,
        long: true,
      })
      cilia.push({
        root: onLobe(side, a, 0.86, R * 0.025),
        out,
        length: R * 0.09,
        u: around,
        long: false,
      })
    }
    if (side > 0)
      group.add(marker('Ciliated band', onLobe(side, Math.PI * 0.5, 1)))
  }

  const positions = new Float32Array(cilia.length * 6)
  const lines = new BufferGeometry()
  lines.setAttribute('position', new Float32BufferAttribute(positions, 3))
  const hairs = new LineSegments(
    own.geometry(lines),
    own.material(
      new LineBasicMaterial({
        color: rgb([246, 238, 226]),
        transparent: true,
        opacity: 0.85,
      }),
    ),
  )
  hairs.frustumCulled = false
  group.add(hairs)

  const tip = new Vector3()
  /** A quick power stroke and a slower recovery, between -1 and 1. */
  const stroke = (x: number) => (Math.sin(x) + 0.35 * Math.sin(2 * x)) / 1.17
  const beat = (t: number) => {
    const attribute = lines.getAttribute('position') as Float32BufferAttribute
    cilia.forEach((cilium, i) => {
      // Waves run around the rim, several at a time (a metachronal wave).
      const phase = t * Math.PI * 2 * 0.9 - cilium.u * Math.PI * 2 * 5
      // Long cilia swing from raised (recovery) down towards the short band (power stroke);
      // the short cilia beat the other way, up towards the long ones.
      const angle = cilium.long
        ? 0.35 + 0.7 * stroke(phase)
        : -0.55 - 0.45 * stroke(phase + Math.PI)
      tip
        .copy(cilium.out)
        .multiplyScalar(Math.cos(angle) * cilium.length)
        .add(cilium.root)
      tip.y += Math.sin(angle) * cilium.length
      attribute.setXYZ(i * 2, cilium.root.x, cilium.root.y, cilium.root.z)
      attribute.setXYZ(i * 2 + 1, tip.x, tip.y, tip.z)
    })
    attribute.needsUpdate = true
  }
  beat(0)
  return { group, beat }
}
