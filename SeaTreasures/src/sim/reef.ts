import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three'
import { blendRgb, fbm, linear, noise3, paint } from './kit.ts'
import type { Rgb } from './patterns.ts'

/**
 * Reef life, drawn as illustrations of familiar forms rather than particular
 * species: branching and table corals, brain and boulder corals, plate corals,
 * sea fans, leather and tree soft corals, anemones, sponges, sea whips,
 * urchins, sea stars, sea cucumbers, rocks with algae, seagrass and kelp.
 * Each builder returns painted pieces in its own frame (base at the origin,
 * +y up, `S` its size) for the scenery to place and merge.
 */
export type Random = () => number

const UP = new Vector3(0, 1, 0)
const TAU = Math.PI * 2

/** A tapered tube from `a` to `b`, open at both ends, with `radial` sides. */
function segment(
  a: Vector3,
  b: Vector3,
  ra: number,
  rb: number,
  radial = 6,
  capped = false,
) {
  const length = Math.max(1e-6, a.distanceTo(b))
  const geometry = new CylinderGeometry(rb, ra, length, radial, 1, true)
  geometry.translate(0, length / 2, 0)
  const matrix = new Matrix4().compose(
    a,
    new Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()),
    new Vector3(1, 1, 1),
  )
  geometry.applyMatrix4(matrix)
  if (!capped) return [geometry]
  const tip = new SphereGeometry(rb, radial, 3, 0, TAU, 0, Math.PI / 2)
  tip.applyMatrix4(
    new Matrix4().compose(
      b,
      new Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize()),
      new Vector3(1, 1, 1),
    ),
  )
  return [geometry, tip]
}

/** A tube along a curve, tapering to `tip` of its radius. */
function tube(
  points: Vector3[],
  radius: number,
  tip = 0.3,
  steps = 8,
  radial = 5,
) {
  const curve = new CatmullRomCurve3(points)
  const geometry = new TubeGeometry(curve, steps, radius, radial, false)
  const position = geometry.getAttribute('position')
  const p = new Vector3()
  for (let ring = 0; ring <= steps; ring++) {
    const t = ring / steps
    const centre = curve.getPoint(t)
    const keep = 1 - (1 - tip) * t
    for (let k = 0; k <= radial; k++) {
      const index = ring * (radial + 1) + k
      p.fromBufferAttribute(position, index)
        .sub(centre)
        .multiplyScalar(keep)
        .add(centre)
      position.setXYZ(index, p.x, p.y, p.z)
    }
  }
  geometry.computeVertexNormals()
  return geometry
}

const between = (random: Random, a: number, b: number) => a + (b - a) * random()
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Colour by height, from a darker base to paler living tips, with a little mottling. */
function gradient(base: Rgb, tip: Rgb, height: number, mottle = 0.08) {
  const a = linear(base)
  const b = linear(tip)
  return (p: Vector3, _n: Vector3, out: Color) => {
    const t = smooth(0, 1, p.y / height)
    out.copy(a).lerp(b, t * t)
    out.multiplyScalar(
      1 +
        mottle *
          noise3((p.x * 9) / height, (p.y * 9) / height, (p.z * 9) / height),
    )
  }
}

/** Staghorn and bushy branching corals (Acropora-like), with pale growing tips. */
export function branching(random: Random, S: number, colour: Rgb, tip: Rgb) {
  const parts: BufferGeometry[] = []
  const bushy = random() > 0.5
  const stems = bushy
    ? 6 + Math.floor(random() * 4)
    : 3 + Math.floor(random() * 3)
  const grow = (
    from: Vector3,
    dir: Vector3,
    length: number,
    radius: number,
    depth: number,
  ) => {
    const to = from.clone().addScaledVector(dir, length)
    parts.push(...segment(from, to, radius, radius * 0.78, 6, depth === 0))
    if (depth === 0) return
    const forks = random() > 0.35 ? 2 : 1
    for (let k = 0; k < forks; k++) {
      const turn = new Vector3(
        between(random, -1, 1),
        between(random, 0.3, 0.9),
        between(random, -1, 1),
      )
      const next = dir
        .clone()
        .add(turn.multiplyScalar(bushy ? 0.5 : 0.75))
        .normalize()
      if (next.y < 0.25) next.y = 0.25
      grow(
        to,
        next.normalize(),
        length * (bushy ? 0.7 : 0.8),
        radius * 0.75,
        depth - 1,
      )
    }
  }
  for (let s = 0; s < stems; s++) {
    const dir = new Vector3(
      between(random, -0.7, 0.7),
      1,
      between(random, -0.7, 0.7),
    ).normalize()
    grow(
      new Vector3(
        between(random, -0.15, 0.15) * S,
        0,
        between(random, -0.15, 0.15) * S,
      ),
      dir,
      S * (bushy ? 0.2 : 0.3),
      S * (bushy ? 0.045 : 0.055),
      bushy ? 3 : 3,
    )
  }
  const height = S * (bushy ? 0.6 : 0.95)
  const g = gradient(colour, tip, height, 0.1)
  return { pieces: parts.map((part) => paint(part, g)), top: height * 0.85 }
}

/** A brain coral: a dome with meandering ridges and valleys. */
export function brain(random: Random, S: number, colour: Rgb, valley: Rgb) {
  const geometry = new SphereGeometry(1, 64, 30, 0, TAU, 0, Math.PI * 0.55)
  const seed = random() * 50
  const position = geometry.getAttribute('position')
  const ridges: number[] = []
  const p = new Vector3()
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i)
    const m = Math.abs(
      Math.sin(fbm(p.x * 2.2 + seed, p.y * 2.2, p.z * 2.2, 3) * 16),
    )
    const ridge = smooth(0.05, 0.6, m)
    ridges.push(ridge)
    p.multiplyScalar(
      1 + 0.03 * ridge + 0.07 * noise3(p.x * 1.4 + seed, p.y * 1.4, p.z * 1.4),
    )
    position.setXYZ(i, p.x, p.y, p.z)
  }
  geometry.computeVertexNormals()
  geometry.scale(S * 0.55, S * 0.42, S * 0.5)
  geometry.translate(0, -S * 0.06, 0)
  const top = linear(colour)
  const low = linear(valley)
  let k = 0
  const painted = paint(geometry, (_p, _n, out) => {
    out.copy(low).lerp(top, ridges[k++]!)
  })
  return { pieces: [painted], top: S * 0.34 }
}

/** A lumpy boulder coral (Porites-like), finely speckled with polyps. */
export function boulder(random: Random, S: number, colour: Rgb) {
  const geometry = new SphereGeometry(1, 40, 20, 0, TAU, 0, Math.PI * 0.6)
  const seed = random() * 50
  const position = geometry.getAttribute('position')
  const p = new Vector3()
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i)
    p.multiplyScalar(1 + 0.16 * fbm(p.x * 1.8 + seed, p.y * 1.8, p.z * 1.8, 2))
    position.setXYZ(i, p.x, p.y, p.z)
  }
  geometry.computeVertexNormals()
  geometry.scale(
    S * between(random, 0.5, 0.75),
    S * 0.45,
    S * between(random, 0.5, 0.7),
  )
  geometry.translate(0, -S * 0.08, 0)
  const c = linear(colour)
  const painted = paint(geometry, (q, n, out) => {
    out
      .copy(c)
      .multiplyScalar(
        0.82 +
          0.18 * Math.max(0, n.y) +
          0.1 * noise3((q.x * 40) / S, (q.y * 40) / S, (q.z * 40) / S),
      )
  })
  return { pieces: [painted], top: S * 0.36 }
}

/** A table coral: a flat plate on a short stalk, with radiating growth lines and a paler rim. */
export function table(random: Random, S: number, colour: Rgb) {
  const R = S * between(random, 0.55, 0.75)
  const h = S * between(random, 0.32, 0.5)
  const profile = [
    new Vector2(0.001, 0),
    new Vector2(S * 0.1, 0),
    new Vector2(S * 0.07, h * 0.7),
    new Vector2(S * 0.2, h * 0.92),
    new Vector2(R, h),
    new Vector2(R * 1.01, h + S * 0.035),
    new Vector2(R * 0.6, h + S * 0.05),
    new Vector2(0.001, h + S * 0.06),
  ]
  const geometry = new LatheGeometry(profile, 48)
  const seed = random() * 20
  const position = geometry.getAttribute('position')
  const p = new Vector3()
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i)
    const r = Math.hypot(p.x, p.z)
    if (r > S * 0.22) {
      const a = Math.atan2(p.z, p.x)
      const k =
        1 + 0.14 * noise3(Math.cos(a) * 1.5 + seed, Math.sin(a) * 1.5, 0)
      p.x *= k
      p.z *= k
      p.y += Math.sin(a * 3 + seed) * S * 0.03 * (r / R)
    }
    position.setXYZ(i, p.x, p.y, p.z)
  }
  geometry.computeVertexNormals()
  const c = linear(colour)
  const rim = linear(blendRgb(colour, [235, 225, 205], 0.45))
  const painted = paint(geometry, (q, _n, out) => {
    const r = Math.hypot(q.x, q.z) / R
    const a = Math.atan2(q.z, q.x)
    out.copy(c).lerp(rim, smooth(0.75, 1.05, r))
    out.multiplyScalar(0.92 + 0.08 * Math.sin(a * 70))
  })
  return { pieces: [painted], top: h + S * 0.06 }
}

/** Plate corals: thin whorled cups stacked like lettuce or a spiral staircase. */
export function plates(random: Random, S: number, colour: Rgb) {
  const pieces: BufferGeometry[] = []
  const count = 3 + Math.floor(random() * 3)
  const c = linear(colour)
  const rim = linear(blendRgb(colour, [240, 230, 200], 0.5))
  for (let k = 0; k < count; k++) {
    const R = S * between(random, 0.3, 0.5)
    const profile = [
      new Vector2(R * 0.08, 0),
      new Vector2(R * 0.5, R * 0.12),
      new Vector2(R, R * 0.4),
      new Vector2(R * 0.98, R * 0.44),
      new Vector2(R * 0.48, R * 0.17),
      new Vector2(R * 0.06, R * 0.03),
    ]
    const geometry = new LatheGeometry(
      profile,
      28,
      0,
      TAU * between(random, 0.55, 0.85),
    )
    paint(geometry, (q, _n, out) =>
      out.copy(c).lerp(rim, smooth(0.7, 1, Math.hypot(q.x, q.z) / R)),
    )
    geometry.applyMatrix4(
      new Matrix4().compose(
        new Vector3(
          between(random, -0.2, 0.2) * S,
          S * 0.12 * k,
          between(random, -0.2, 0.2) * S,
        ),
        new Quaternion().setFromAxisAngle(
          new Vector3(
            between(random, -1, 1),
            0,
            between(random, -1, 1),
          ).normalize(),
          between(random, 0.2, 0.6),
        ),
        new Vector3(1, 1, 1),
      ),
    )
    pieces.push(geometry)
  }
  return { pieces, top: S * 0.12 * count + S * 0.15 }
}

/** Elkhorn coral: broad, flattened antlers spreading low over the reef. */
export function elkhorn(random: Random, S: number, colour: Rgb) {
  const parts: BufferGeometry[] = []
  const arms = 4 + Math.floor(random() * 3)
  for (let a = 0; a < arms; a++) {
    const angle = (a / arms) * TAU + random() * 0.4
    let from = new Vector3(0, S * 0.05, 0)
    let dir = new Vector3(Math.cos(angle), 0.45, Math.sin(angle)).normalize()
    let width = S * 0.12
    for (let k = 0; k < 3; k++) {
      const to = from.clone().addScaledVector(dir, S * 0.28)
      const piece = new CylinderGeometry(
        width * 0.8,
        width,
        S * 0.28,
        8,
        1,
        true,
      )
      piece.scale(1, 1, 0.32)
      piece.translate(0, S * 0.14, 0)
      piece.applyMatrix4(
        new Matrix4().compose(
          from,
          new Quaternion().setFromUnitVectors(UP, dir),
          new Vector3(1, 1, 1),
        ),
      )
      parts.push(piece)
      from = to
      dir = dir
        .clone()
        .add(
          new Vector3(
            between(random, -0.4, 0.4),
            0.1,
            between(random, -0.4, 0.4),
          ),
        )
        .normalize()
      width *= 0.8
    }
  }
  const g = gradient(
    colour,
    blendRgb(colour, [244, 226, 180], 0.5),
    S * 0.7,
    0.12,
  )
  return { pieces: parts.map((part) => paint(part, g)), top: S * 0.55 }
}

/** A sea fan (gorgonian): a flat, finely branched net facing the current. Sways. */
export function fan(random: Random, S: number, colour: Rgb, E: number) {
  const parts: BufferGeometry[] = []
  const plane = new Vector3(0, 0, 1)
  const grow = (
    from: Vector3,
    dir: Vector3,
    length: number,
    radius: number,
    depth: number,
  ) => {
    const to = from.clone().addScaledVector(dir, length)
    parts.push(...segment(from, to, radius, radius * 0.8, 3))
    if (depth === 0) return
    for (let k = 0; k < 2; k++) {
      const turn = new Vector3(
        between(random, -1, 1),
        between(random, 0.2, 0.7),
        0,
      ).projectOnPlane(plane)
      const next = dir.clone().add(turn.multiplyScalar(0.8)).normalize()
      if (next.y < 0.1) next.y = 0.1
      grow(to, next.normalize(), length * 0.8, radius * 0.75, depth - 1)
    }
  }
  grow(new Vector3(), UP.clone(), S * 0.25, S * 0.022, 6)
  const height = S * 1.1
  const g = gradient(
    blendRgb(colour, [60, 40, 40], 0.3),
    colour,
    height * 0.5,
    0.06,
  )
  const sway = (p: Vector3) =>
    E * 0.05 * Math.pow(Math.max(0, p.y) / height, 1.2)
  const phase = random() * TAU
  return {
    pieces: parts.map((part) => paint(part, g, sway, phase)),
    top: height * 0.7,
  }
}

/** A leather coral: a mushroom with a folded, velvety cap. Sways a little. */
export function leather(random: Random, S: number, colour: Rgb, E: number) {
  const R = S * between(random, 0.35, 0.5)
  const profile = [
    new Vector2(0.001, 0),
    new Vector2(S * 0.12, 0),
    new Vector2(S * 0.1, S * 0.18),
    new Vector2(R * 0.9, S * 0.27),
    new Vector2(R, S * 0.3),
    new Vector2(R * 0.7, S * 0.33),
    new Vector2(0.001, S * 0.32),
  ]
  const geometry = new LatheGeometry(profile, 40)
  const seed = random() * 10
  const position = geometry.getAttribute('position')
  const p = new Vector3()
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i)
    const r = Math.hypot(p.x, p.z)
    const a = Math.atan2(p.z, p.x)
    p.y += Math.sin(a * 7 + seed) * S * 0.05 * Math.pow(r / R, 2)
    position.setXYZ(i, p.x, p.y, p.z)
  }
  geometry.computeVertexNormals()
  const c = linear(colour)
  const stalk = linear(blendRgb(colour, [235, 225, 200], 0.4))
  const painted = paint(
    geometry,
    (q, n, out) => {
      out.copy(stalk).lerp(c, smooth(S * 0.15, S * 0.25, q.y))
      out.multiplyScalar(
        0.9 +
          0.12 * noise3((q.x * 50) / S, (q.y * 50) / S, (q.z * 50) / S) +
          0.05 * n.y,
      )
    },
    (q) => E * 0.02 * Math.max(0, q.y / (S * 0.33)),
    random() * TAU,
  )
  return { pieces: [painted], top: S * 0.33 }
}

/** A tree soft coral: a pale trunk carrying bright, puffy polyp clusters. Sways. */
export function treeCoral(random: Random, S: number, colour: Rgb, E: number) {
  const parts: BufferGeometry[] = []
  const trunk = linear([236, 226, 220])
  const bloom = linear(colour)
  const height = S * 0.8
  const phase = random() * TAU
  const sway = (p: Vector3) => E * 0.035 * Math.max(0, p.y / height)
  const grow = (
    from: Vector3,
    dir: Vector3,
    length: number,
    radius: number,
    depth: number,
  ) => {
    const to = from.clone().addScaledVector(dir, length)
    parts.push(
      paint(
        segment(from, to, radius, radius * 0.7, 5)[0]!,
        (_q, _n, out) => out.copy(trunk),
        sway,
        phase,
      ),
    )
    if (depth === 0) {
      for (let k = 0; k < 4; k++) {
        const puff = new SphereGeometry(S * between(random, 0.04, 0.07), 7, 5)
        puff.translate(
          to.x + between(random, -1, 1) * S * 0.05,
          to.y + between(random, -0.5, 1) * S * 0.04,
          to.z + between(random, -1, 1) * S * 0.05,
        )
        parts.push(
          paint(
            puff,
            (q, _n, out) =>
              out
                .copy(bloom)
                .multiplyScalar(
                  0.85 +
                    0.25 *
                      noise3((q.x * 60) / S, (q.y * 60) / S, (q.z * 60) / S),
                ),
            sway,
            phase,
          ),
        )
      }
      return
    }
    for (let k = 0; k < 3; k++) {
      const next = dir
        .clone()
        .add(
          new Vector3(
            between(random, -1, 1),
            between(random, 0.2, 0.8),
            between(random, -1, 1),
          ),
        )
        .normalize()
      grow(to, next, length * 0.7, radius * 0.7, depth - 1)
    }
  }
  grow(new Vector3(), UP.clone(), S * 0.3, S * 0.08, 2)
  return { pieces: parts, top: height * 0.7 }
}

/** A sea anemone: a short column, an oral disc and a ring of swaying tentacles. */
export function anemone(random: Random, S: number, colour: Rgb, E: number) {
  const pieces: BufferGeometry[] = []
  const R = S * 0.32
  const phase = random() * TAU
  const column = new CylinderGeometry(R * 0.8, R * 0.7, S * 0.12, 18, 1, true)
  column.translate(0, S * 0.06, 0)
  pieces.push(paint(column, blendRgb(colour, [200, 120, 110], 0.4)))
  const disc = new SphereGeometry(R * 0.85, 18, 6, 0, TAU, 0, Math.PI / 2)
  disc.scale(1, 0.25, 1)
  disc.translate(0, S * 0.12, 0)
  pieces.push(paint(disc, blendRgb(colour, [120, 90, 70], 0.4)))
  const tip = blendRgb(colour, [250, 240, 220], 0.4)
  const g = gradient(colour, tip, S * 0.4, 0.05)
  const count = 70
  for (let k = 0; k < count; k++) {
    const a = (k / count) * TAU * 3.7
    const r = R * Math.sqrt((k + 0.5) / count) * 0.95
    const base = new Vector3(Math.cos(a) * r, S * 0.13, Math.sin(a) * r)
    const out = new Vector3(Math.cos(a), 0, Math.sin(a))
    const length = S * between(random, 0.18, 0.3)
    const points = [
      base,
      base
        .clone()
        .addScaledVector(out, length * 0.3)
        .add(new Vector3(0, length * 0.45, 0)),
      base
        .clone()
        .addScaledVector(out, length * 0.75)
        .add(new Vector3(0, length * 0.7, 0)),
    ]
    const t = tube(points, S * 0.018, 0.7, 4, 4)
    pieces.push(
      paint(
        t,
        g,
        (q) => E * 0.03 * Math.max(0, (q.y - S * 0.13) / length),
        phase + k * 0.05,
      ),
    )
  }
  return { pieces, top: S * 0.35 }
}

/** Tube sponges: a cluster of tall, open tubes. */
export function tubeSponge(random: Random, S: number, colour: Rgb) {
  const pieces: BufferGeometry[] = []
  const count = 3 + Math.floor(random() * 4)
  const c = linear(colour)
  const lip = linear(blendRgb(colour, [250, 240, 230], 0.25))
  let top = 0
  for (let k = 0; k < count; k++) {
    const h = S * between(random, 0.5, 1.3)
    const r = S * between(random, 0.07, 0.12)
    const geometry = new CylinderGeometry(r * 1.1, r * 0.8, h, 14, 4, true)
    geometry.translate(0, h / 2, 0)
    const position = geometry.getAttribute('position')
    const p = new Vector3()
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i)
      p.x += Math.sin((p.y / h) * 2 + k) * r * 0.4
      position.setXYZ(i, p.x, p.y, p.z)
    }
    geometry.computeVertexNormals()
    paint(geometry, (q, _n, out) => {
      out.copy(c).lerp(lip, smooth(h * 0.85, h, q.y))
      out.multiplyScalar(
        0.9 + 0.12 * noise3((q.x * 30) / S, (q.y * 30) / S, (q.z * 30) / S),
      )
    })
    const lean = new Quaternion().setFromAxisAngle(
      new Vector3(
        between(random, -1, 1),
        0,
        between(random, -1, 1),
      ).normalize(),
      between(random, 0, 0.35),
    )
    geometry.applyMatrix4(
      new Matrix4().compose(
        new Vector3(
          between(random, -1, 1) * S * 0.12,
          0,
          between(random, -1, 1) * S * 0.12,
        ),
        lean,
        new Vector3(1, 1, 1),
      ),
    )
    pieces.push(geometry)
    top = Math.max(top, h)
  }
  return { pieces, top }
}

/** A barrel or vase sponge, with vertical ridges. */
export function barrel(random: Random, S: number, colour: Rgb) {
  const H = S * between(random, 0.6, 1.1)
  const profile = [0, 0.1, 0.3, 0.6, 0.85, 1].map(
    (f) =>
      new Vector2(
        S * (0.18 + 0.26 * Math.pow(f, 0.8)) * (f > 0.95 ? 0.92 : 1),
        H * f,
      ),
  )
  const geometry = new LatheGeometry(profile, 36)
  const position = geometry.getAttribute('position')
  const p = new Vector3()
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i)
    const a = Math.atan2(p.z, p.x)
    const k = 1 + 0.06 * Math.sin(a * 16)
    p.x *= k
    p.z *= k
    position.setXYZ(i, p.x, p.y, p.z)
  }
  geometry.computeVertexNormals()
  const c = linear(colour)
  const painted = paint(geometry, (q, _n, out) => {
    const a = Math.atan2(q.z, q.x)
    out.copy(c).multiplyScalar(0.8 + 0.2 * (0.5 + 0.5 * Math.sin(a * 16)))
  })
  return { pieces: [painted], top: H }
}

/** A slender sea whip. Sways. */
export function seaWhip(random: Random, S: number, colour: Rgb, E: number) {
  const height = S * between(random, 1.2, 2.6)
  const bend = between(random, -0.4, 0.4)
  const points = [0, 0.4, 0.75, 1].map(
    (f) => new Vector3(Math.sin(f * 2) * bend * height * 0.3, height * f, 0),
  )
  const geometry = tube(points, S * 0.02, 0.3, 12, 5)
  return {
    pieces: [
      paint(
        geometry,
        gradient(blendRgb(colour, [80, 50, 40], 0.3), colour, height, 0.04),
        (q) => E * 0.06 * Math.pow(Math.max(0, q.y) / height, 1.5),
        random() * TAU,
      ),
    ],
    top: height,
  }
}

/** A long-spined sea urchin (Diadema-like). */
export function urchin(random: Random, S: number) {
  const pieces: BufferGeometry[] = []
  const body = new SphereGeometry(S * 0.07, 12, 8)
  body.scale(1, 0.75, 1)
  body.translate(0, S * 0.04, 0)
  pieces.push(paint(body, [26, 22, 30]))
  for (let k = 0; k < 34; k++) {
    const d = new Vector3(
      between(random, -1, 1),
      between(random, -0.1, 1),
      between(random, -1, 1),
    ).normalize()
    const from = d
      .clone()
      .multiplyScalar(S * 0.06)
      .add(new Vector3(0, S * 0.04, 0))
    const to = d
      .clone()
      .multiplyScalar(S * between(random, 0.25, 0.38))
      .add(new Vector3(0, S * 0.04, 0))
    const spine = segment(from, to, S * 0.006, S * 0.0012, 3)[0]!
    pieces.push(
      paint(spine, (q, _n, out) =>
        out
          .copy(linear([30, 28, 40]))
          .lerp(linear([70, 80, 120]), (q.distanceTo(from) / S) * 2),
      ),
    )
  }
  return { pieces, top: S * 0.12 }
}

/** A sea star lying on the sand: five tapering arms on a domed body. */
export function seaStar(random: Random, S: number, colour: Rgb) {
  const rings = 8
  const around = 60
  const positions: number[] = []
  const index: number[] = []
  const R = S * 0.5
  const fat = between(random, 0.22, 0.4)
  const turn = random() * TAU
  for (let i = 0; i <= rings; i++) {
    const rho = i / rings
    for (let j = 0; j < around; j++) {
      const t = (j / around) * TAU
      const arm =
        fat + (1 - fat) * Math.pow(Math.abs(Math.cos((t + turn) * 2.5)), 1.4)
      const r = rho * R * arm
      const y = S * 0.09 * (1 - rho * rho) * (0.4 + 0.6 * arm)
      positions.push(Math.cos(t) * r, y + S * 0.005, Math.sin(t) * r)
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < around; j++) {
      const a = i * around + j
      const b = i * around + ((j + 1) % around)
      const c = a + around
      const d = b + around
      index.push(a, c, b, b, c, d)
    }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  const c = linear(colour)
  const painted = paint(geometry, (q, _n, out) => {
    out
      .copy(c)
      .multiplyScalar(
        0.85 + 0.2 * noise3((q.x * 60) / S, (q.y * 60) / S, (q.z * 60) / S),
      )
  })
  return { pieces: [painted], top: S * 0.08 }
}

/** A sea cucumber lying on the sand, warty and soft. */
export function cucumber(random: Random, S: number, colour: Rgb) {
  const geometry = new SphereGeometry(1, 24, 12)
  const position = geometry.getAttribute('position')
  const seed = random() * 10
  const p = new Vector3()
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i)
    p.multiplyScalar(
      1 + 0.12 * Math.max(0, noise3(p.x * 4 + seed, p.y * 6, p.z * 6)),
    )
    p.y += 0.25 * (p.x * p.x) - 0.1
    position.setXYZ(i, p.x, p.y, p.z)
  }
  geometry.computeVertexNormals()
  geometry.scale(S * 0.3, S * 0.07, S * 0.08)
  geometry.translate(0, S * 0.05, 0)
  const c = linear(colour)
  const belly = linear(blendRgb(colour, [220, 200, 180], 0.4))
  return {
    pieces: [
      paint(geometry, (_q, n, out) =>
        out.copy(belly).lerp(c, smooth(-0.3, 0.4, n.y)),
      ),
    ],
    top: S * 0.12,
  }
}

/** Tiny Christmas tree worms on a coral head: paired coloured spirals. */
export function treeWorm(random: Random, S: number) {
  const colours: Rgb[] = [
    [230, 80, 60],
    [250, 200, 60],
    [80, 140, 230],
    [250, 250, 250],
    [190, 80, 200],
  ]
  const c = colours[Math.floor(random() * colours.length)]!
  const pieces: BufferGeometry[] = []
  for (const side of [-1, 1]) {
    const cone = new CylinderGeometry(0, S * 0.03, S * 0.07, 7, 2, false)
    cone.translate(side * S * 0.025, S * 0.035, 0)
    pieces.push(paint(cone, c))
  }
  return { pieces, top: S * 0.07 }
}

/** A weathered rock: lumpy, darker in its crevices, with algae or encrusting growth on top. */
export function rock(
  random: Random,
  R: number,
  colour: Rgb,
  cover: Rgb | null,
  squash: number,
) {
  const geometry = new SphereGeometry(1, 30, 18)
  const position = geometry.getAttribute('position')
  const seed = random() * 30
  const depth: number[] = []
  const p = new Vector3()
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i)
    const bump = fbm(p.x * 1.6 + seed, p.y * 1.6, p.z * 1.6, 3)
    depth.push(bump)
    p.multiplyScalar(1 + 0.28 * bump)
    position.setXYZ(i, p.x, p.y, p.z)
  }
  geometry.computeVertexNormals()
  const c = linear(colour)
  const top = cover ? linear(cover) : null
  let k = 0
  paint(geometry, (q, n, out) => {
    const d = depth[k++]!
    out
      .copy(c)
      .multiplyScalar(
        0.7 +
          0.45 * smooth(-0.3, 0.3, d) +
          0.08 * noise3(q.x * 12, q.y * 12, q.z * 12),
      )
    if (top)
      out.lerp(
        top,
        smooth(0.35, 0.85, n.y) *
          (0.6 + 0.4 * noise3(q.x * 3 + seed, q.y * 3, q.z * 3)),
      )
  })
  geometry.scale(R, R * squash, R * between(random, 0.75, 1))
  return { pieces: [geometry], top: R * squash * 0.95 }
}

/** One seagrass blade, curving and swaying, with grazed, epiphyte-spotted tips. */
export function blade(
  random: Random,
  width: number,
  height: number,
  colour: Rgb,
  E: number,
  phase: number,
) {
  const geometry = new PlaneGeometry(width, 1, 1, 5)
  geometry.translate(0, 0.5, 0)
  const position = geometry.getAttribute('position')
  const curl = between(random, 0.15, 0.35)
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i)
    position.setXYZ(
      i,
      position.getX(i) * (1 - 0.3 * y),
      y * height,
      y * y * height * curl,
    )
  }
  geometry.computeVertexNormals()
  const base = linear(blendRgb(colour, [200, 210, 170], 0.35))
  const mid = linear(colour)
  const tip = linear(blendRgb(colour, [170, 150, 100], 0.45))
  return paint(
    geometry,
    (q, _n, out) => {
      const t = q.y / height
      if (t < 0.15) out.copy(base).lerp(mid, t / 0.15)
      else out.copy(mid).lerp(tip, smooth(0.6, 1, t))
    },
    (q) => E * 0.12 * Math.pow(q.y / height, 2) * (height / E),
    phase,
  )
}

/** A kelp plant or a bushy brown alga: stipes, blades and floats. Sways. */
export function kelp(random: Random, E: number, tall: boolean) {
  const pieces: BufferGeometry[] = []
  const height = E * (tall ? between(random, 3, 7) : between(random, 0.8, 1.8))
  const phase = random() * TAU
  const sway = (p: Vector3) =>
    E * (tall ? 0.35 : 0.12) * Math.pow(Math.max(0, p.y) / height, 1.4)
  const stems = tall ? 1 : 4
  for (let s = 0; s < stems; s++) {
    const lean = new Vector3(
      between(random, -0.25, 0.25),
      1,
      between(random, -0.25, 0.25),
    ).normalize()
    const points = [0, 0.33, 0.66, 1].map((f) =>
      lean
        .clone()
        .multiplyScalar(height * f)
        .add(new Vector3(Math.sin(f * 3 + s) * E * 0.15, 0, 0)),
    )
    pieces.push(
      paint(
        tube(points, E * (tall ? 0.03 : 0.018), 0.6, 12, 5),
        [118, 98, 46],
        sway,
        phase,
      ),
    )
    const count = tall ? Math.floor(height / (E * 0.35)) : 8
    for (let k = 1; k < count; k++) {
      const f = k / count
      const base = points[0]!.clone().lerp(points[3]!, f)
      const length =
        E * (tall ? between(random, 0.5, 0.9) : between(random, 0.12, 0.22))
      const leaf = new PlaneGeometry(length * (tall ? 0.28 : 0.4), length, 1, 3)
      leaf.translate(0, length / 2, 0)
      const lp = leaf.getAttribute('position')
      for (let v = 0; v < lp.count; v++) {
        const y = lp.getY(v) / length
        lp.setXYZ(
          v,
          lp.getX(v) * Math.sin(Math.PI * Math.min(1, y * 1.1 + 0.05)),
          lp.getY(v),
          y * y * length * 0.3,
        )
      }
      leaf.computeVertexNormals()
      const side = k % 2 ? 1 : -1
      const turn = new Quaternion()
        .setFromAxisAngle(new Vector3(0, 0, 1), side * 0.9)
        .premultiply(new Quaternion().setFromAxisAngle(UP, (k * 2.4) % TAU))
      // Paint in the plant's frame: sway follows the height on the plant, not on the leaf.
      leaf.applyMatrix4(new Matrix4().compose(base, turn, new Vector3(1, 1, 1)))
      pieces.push(
        paint(
          leaf,
          (p, _n, out) =>
            out
              .copy(linear(tall ? [132, 116, 52] : [150, 120, 50]))
              .multiplyScalar(0.85 + 0.25 * (p.y / height)),
          sway,
          phase,
        ),
      )
      if (random() > 0.5) {
        const bladder = new SphereGeometry(E * (tall ? 0.05 : 0.025), 6, 4)
        bladder.translate(base.x + side * E * 0.06, base.y + E * 0.04, base.z)
        pieces.push(paint(bladder, [168, 140, 64], sway, phase))
      }
    }
  }
  return { pieces, top: height }
}
