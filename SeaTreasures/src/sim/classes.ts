import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import type { Material } from 'three'
import { fbm, linear, noise3 } from './kit.ts'
import { marker, markMesh } from './labels.ts'
import type { Rgb } from './patterns.ts'
import { seeded } from './patterns.ts'

/**
 * The shelled molluscs that are not snails or a nautilus: a bivalve (giant
 * clam), a chiton, a tusk shell and a monoplacophoran. Each is drawn from its
 * sourced description (data/research/classes.json) as an illustration, in its
 * life pose: base on the floor at y = 0, front towards +x.
 */
export type ClassKind = 'clam' | 'chiton' | 'tusk' | 'cap'

export type ClassAnimal = {
  /** Hard parts, which lift away when the reader takes it apart. */
  shell: Group
  /** Soft parts inside, seen when cut open or seen through. */
  body: Group
  /** Soft parts outside, which draw in when the animal is poked. */
  outside: Group
  /** Lowest point below the floor that is buried on purpose (tusk shell), as a share of height. */
  buried: number
}

type Own = {
  geometry<T extends BufferGeometry>(value: T): T
  material<T extends Material>(value: T): T
}

export type ClassMaterials = {
  /** Vertex-coloured, glossy shell (see-through and cut planes applied). */
  shell: Material
  /** Vertex-coloured shell inside. */
  inner: Material
  /** Vertex-coloured living tissue, fading as the animal dies. */
  tissue: Material
}

const TAU = Math.PI * 2
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** A grid surface from a function of (u, v) in [0, 1]², with vertex colours. */
function surface(
  rows: number,
  cols: number,
  at: (u: number, v: number) => Vector3,
  colour: (u: number, v: number, p: Vector3, out: Color) => void,
  wrap = false,
) {
  const positions: number[] = []
  const colours: number[] = []
  const index: number[] = []
  const c = new Color()
  const across = wrap ? cols : cols + 1
  for (let i = 0; i <= rows; i++)
    for (let j = 0; j < across; j++) {
      const u = i / rows
      const v = j / cols
      const p = at(u, v)
      colour(u, v, p, c)
      positions.push(p.x, p.y, p.z)
      colours.push(c.r, c.g, c.b)
    }
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const a = i * across + j
      const b = i * across + ((j + 1) % across)
      const d = a + across
      const e = b + across
      index.push(a, d, b, b, d, e)
    }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return geometry
}

/** A thin tube along points, in one colour, tapering to `tip`. */
function strand(
  points: Vector3[],
  radius: number,
  colour: Rgb,
  tip = 0.4,
  radial = 5,
) {
  const curve = new CatmullRomCurve3(points)
  const steps = Math.max(4, points.length * 3)
  const geometry = new TubeGeometry(curve, steps, radius, radial, false)
  const position = geometry.getAttribute('position')
  const p = new Vector3()
  for (let ring = 0; ring <= steps; ring++) {
    const centre = curve.getPoint(ring / steps)
    const keep = 1 - (1 - tip) * (ring / steps)
    for (let k = 0; k <= radial; k++) {
      const i = ring * (radial + 1) + k
      p.fromBufferAttribute(position, i)
        .sub(centre)
        .multiplyScalar(keep)
        .add(centre)
      position.setXYZ(i, p.x, p.y, p.z)
    }
  }
  geometry.computeVertexNormals()
  return tinted(geometry, colour)
}

function tinted(
  geometry: BufferGeometry,
  colour: Rgb | ((p: Vector3, out: Color) => void),
) {
  const position = geometry.getAttribute('position')
  const colours = new Float32Array(position.count * 3)
  const c = new Color()
  const p = new Vector3()
  for (let i = 0; i < position.count; i++) {
    if (Array.isArray(colour)) linear(colour, c)
    else colour(p.fromBufferAttribute(position, i), c)
    colours[i * 3] = c.r
    colours[i * 3 + 1] = c.g
    colours[i * 3 + 2] = c.b
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
  return geometry
}

/**
 * Giant clam (Tridacna gigas): two heavy valves with four to six deep radial
 * folds ending in triangular points, sitting hinge-down with the opening up;
 * the yellow-brown to olive mantle, dotted with blue-green rings, spread over
 * the gape in the sun; an inhalant siphon in it (giant-clam-appearance,
 * giant-clam-zooxanthellae, bivalve-parts).
 */
function clam(
  L: number,
  gape: number,
  own: Own,
  m: ClassMaterials,
): ClassAnimal {
  const shell = new Group()
  const body = new Group()
  const outside = new Group()
  const H = L * 0.62
  const W = L * 0.3
  const folds = 5
  const span = 1.25
  /** The opening's outline in the x-y plane, from the hinge (bottom) to the top. */
  const rim = (a: number) =>
    new Vector3(Math.sin(a) * L * 0.5, Math.cos(a) * H * 0.95 + H * 0.05, 0)
  // Both valves share the zigzag margin; each folds outwards from it.
  const zig = (a: number) => Math.sin((a / span) * folds * Math.PI) * W * 0.22
  const valvePoint = (side: number, r: number, a: number, inset: number) => {
    const m = rim(a)
    const p = new Vector3(m.x * r, m.y * r, 0)
    const bulge = Math.sin(Math.PI * Math.pow(r, 0.85)) * W * (1 - inset * 0.12)
    const fold = zig(a) * Math.pow(r, 1.2)
    p.z =
      side *
        (bulge * (1 - (0.35 * Math.abs(a)) / span) + Math.abs(fold) * 0.6 * r) +
      fold
    // Points at the end of each fold, and a thickened lip.
    const point =
      Math.pow(Math.abs(Math.cos((a / span) * folds * Math.PI * 0.5)), 6) * 0.06
    p.multiplyScalar(1 + point * smooth(0.8, 1, r))
    if (inset) p.z -= side * W * 0.06
    return p
  }
  for (const side of [-1, 1]) {
    // Each valve opens about the hinge line (x) by the gape angle.
    const turn = side * gape
    const valve = new Group()
    valve.rotation.x = turn
    const outer = surface(
      36,
      60,
      (u, v) => valvePoint(side, Math.max(0.02, u), (v * 2 - 1) * span, 0),
      (u, v, p, out) => {
        const a = (v * 2 - 1) * span
        const growth =
          0.5 + 0.5 * Math.sin(u * 46 + noise3(p.x * 0.02, p.y * 0.02, 1) * 3)
        linear([226, 222, 210], out).multiplyScalar(0.86 + 0.1 * growth)
        // Grime and encrusting growth low on the shell, nearer the sand.
        const crust =
          smooth(0.15, -0.35, fbm(p.x * 0.012, p.y * 0.012, side, 2)) *
          smooth(0.7, 0.2, u)
        out.lerp(linear([150, 140, 110]), crust * 0.8)
        // The fold ridges catch the light: a little paler.
        out.multiplyScalar(1 + 0.08 * Math.cos((a / span) * folds * Math.PI))
      },
    )
    const outerMesh = new Mesh(own.geometry(outer), m.shell)
    if (side === 1) markMesh(outerMesh, 'Valve')
    valve.add(outerMesh)
    const inside = surface(
      24,
      48,
      (u, v) =>
        valvePoint(
          side,
          Math.max(0.02, u * 0.97),
          (v * 2 - 1) * span * 0.97,
          1,
        ),
      (_u, _v, _p, out) => linear([246, 244, 238], out),
    )
    valve.add(new Mesh(own.geometry(inside), m.inner))
    shell.add(valve)
  }
  shell.add(marker('Hinge', new Vector3(0, H * 0.08, 0)))
  // The adductor muscle, a column holding the valves, in the middle of the body.
  const adductor = new Mesh(
    own.geometry(
      tinted(
        new CylinderGeometry(W * 0.32, W * 0.32, W * 1.3, 16)
          .rotateX(Math.PI / 2)
          .translate(0, H * 0.42, 0),
        [232, 214, 200],
      ),
    ),
    m.tissue,
  )
  markMesh(adductor, 'Adductor muscle', true)
  body.add(adductor)
  // Gills: folded curtains along each side, which filter the water.
  for (const side of [-1, 1]) {
    const gill = surface(
      6,
      30,
      (u, v) =>
        new Vector3(
          (v - 0.5) * L * 0.7,
          H * (0.18 + 0.45 * u),
          side * W * (0.25 + 0.06 * Math.sin(v * 60)),
        ),
      (_u, _v, _p, out) => linear([214, 170, 150], out),
    )
    const mesh = new Mesh(own.geometry(gill), m.tissue)
    if (side === 1) markMesh(mesh, 'Gill', true)
    body.add(mesh)
  }
  // The mantle, spread over the gape and spilling over the shell's edges in the sun.
  const seed = 7
  const mantle = surface(
    18,
    64,
    (u, v) => {
      const a = (v * 2 - 1) * span * 0.97
      const left = valvePoint(-1, 0.99, a, 0).applyAxisAngle(
        new Vector3(1, 0, 0),
        -gape,
      )
      const right = valvePoint(1, 0.99, a, 0).applyAxisAngle(
        new Vector3(1, 0, 0),
        gape,
      )
      const p = left.clone().lerp(right, u)
      const across = Math.sin(Math.PI * u)
      p.y += across * W * 0.25
      // Thick, ruffled lobes that overhang the shell's rim.
      const out = 1 + 0.12 * Math.pow(1 - across, 3)
      p.z *= out
      p.y += Math.sin(a * 9 + u * 3) * W * 0.03 * (1 - across)
      return p
    },
    (u, v, p, out) => {
      const a = (v * 2 - 1) * span
      linear([118, 112, 58], out)
      // Olive to golden brown in broad mottled patches.
      out.lerp(
        linear([150, 120, 60]),
        smooth(-0.2, 0.4, fbm(p.x * 0.01 + seed, p.y * 0.01, p.z * 0.01, 2)),
      )
      // Many small brilliant blue-green rings.
      const ring =
        Math.abs(noise3(p.x * 0.09, p.z * 0.09, a * 0.5)) < 0.05 &&
        u > 0.12 &&
        u < 0.88
      if (ring) out.copy(linear([60, 210, 210]))
      // The paler edge where it folds over the shell.
      out.lerp(
        linear([196, 180, 120]),
        smooth(0.08, 0, Math.min(u, 1 - u)) * 0.6,
      )
    },
  )
  const mantleMesh = new Mesh(own.geometry(mantle), m.tissue)
  markMesh(mantleMesh, 'Mantle')
  outside.add(mantleMesh)
  // The inhalant siphon: a wide, frilled opening in the mantle where water is drawn in.
  const siphon = new Mesh(
    own.geometry(
      tinted(
        new CylinderGeometry(
          W * 0.16,
          W * 0.2,
          W * 0.08,
          20,
          1,
          true,
        ).translate(L * 0.22, 0, 0),
        [60, 50, 34],
      ),
    ),
    m.tissue,
  )
  siphon.position.y = rim(0.35).y * 1.0 + W * 0.18
  markMesh(siphon, 'Siphon')
  outside.add(siphon)
  return { shell, body, outside, buried: 0.12 }
}

/**
 * West Indian fuzzy chiton (Acanthopleura granulata): eight heavy, eroded
 * shell plates set in a thick girdle densely covered in spiky bristles with a
 * few dark bands; a broad foot beneath (fuzzy-chiton-appearance, chiton-parts).
 */
function chiton(L: number, own: Own, m: ClassMaterials): ClassAnimal {
  const shell = new Group()
  const body = new Group()
  const outside = new Group()
  const Wd = L * 0.58
  const H = L * 0.16
  const random = seeded(1791)
  // The girdle: a thick oval collar, lowest at the rim.
  const girdle = surface(
    10,
    72,
    (u, v) => {
      const a = v * TAU
      const r = 0.62 + 0.38 * u
      return new Vector3(
        Math.cos(a) * L * 0.5 * r,
        H * 0.55 * (1 - u * u) + L * 0.01,
        Math.sin(a) * Wd * 0.5 * r,
      )
    },
    (u, v, p, out) => {
      linear([120, 108, 86], out)
      const a = v * TAU
      // A few dark bands across the girdle.
      if (Math.cos(a * 4) > 0.82) out.copy(linear([40, 36, 30]))
      out.multiplyScalar(0.85 + 0.25 * noise3(p.x * 0.4, p.z * 0.4, u * 3))
    },
    true,
  )
  const girdleMesh = new Mesh(own.geometry(girdle), m.tissue)
  markMesh(girdleMesh, 'Girdle')
  outside.add(girdleMesh)
  // Bristles: short spiky hairs all over the girdle.
  const hairs: BufferGeometry[] = []
  for (let k = 0; k < 420; k++) {
    const a = random() * TAU
    const r = 0.66 + 0.33 * random()
    const base = new Vector3(
      Math.cos(a) * L * 0.5 * r,
      H * 0.55 * (1 - ((r - 0.62) / 0.38) ** 2) + L * 0.01,
      Math.sin(a) * Wd * 0.5 * r,
    )
    const dir = new Vector3(Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6).normalize()
    const length = L * (0.02 + 0.025 * random())
    const hair = new CylinderGeometry(0, L * 0.0035, length, 3)
    hair.translate(0, length / 2, 0)
    hair.applyMatrix4(
      new Matrix4().compose(
        base,
        new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir),
        new Vector3(1, 1, 1),
      ),
    )
    hairs.push(tinted(hair, random() > 0.85 ? [40, 34, 28] : [150, 136, 110]))
  }
  outside.add(new Mesh(own.geometry(merge(hairs)), m.tissue))
  // Eight overlapping plates arched along the back, heavily eroded on top.
  for (let k = 0; k < 8; k++) {
    const x0 = -L * 0.33 + (k / 8) * L * 0.66
    const x1 = x0 + (L * 0.66) / 8 + L * 0.025
    const end = k === 0 || k === 7
    const plate = surface(
      6,
      28,
      (u, v) => {
        const x = x0 + (x1 - x0) * u
        const a = (v - 0.5) * Math.PI * 0.92
        const narrow = 1 - Math.pow(Math.abs(x) / (L * 0.42), 3)
        const w = Wd * 0.36 * narrow
        // Each plate's back edge rides up over the next, as the plates overlap.
        const lift = H * 0.12 * u
        return new Vector3(
          x,
          H * 0.55 + Math.cos(a) * H * 0.75 * narrow + lift,
          Math.sin(a) * w,
        )
      },
      (u, v, p, out) => {
        linear([96, 90, 80], out)
        // Eroded crest: paler, worn chalky grey along the middle.
        const crest = smooth(0.35, 0, Math.abs(v - 0.5))
        out.lerp(
          linear([196, 190, 176]),
          crest * 0.75 * (0.6 + 0.4 * noise3(p.x * 0.3, p.z * 0.3, k)),
        )
        // Granular sculpture and the dark dots of the shell eyes on the flanks.
        if (
          !end &&
          Math.abs(v - 0.5) > 0.2 &&
          noise3(p.x * 2.2, p.z * 2.2, k * 3) > 0.62
        )
          out.multiplyScalar(0.35)
        out.multiplyScalar(0.92 + 0.08 * Math.sin(u * 20))
      },
    )
    const mesh = new Mesh(own.geometry(plate), m.shell)
    if (k === 4) markMesh(mesh, 'Plate')
    shell.add(mesh)
  }
  shell.add(marker('Shell eyes', new Vector3(-L * 0.05, H * 1.15, Wd * 0.2)))
  // Underneath: the broad foot, with the gills in the groove around it and the radula at the mouth.
  const foot = new Mesh(
    own.geometry(
      tinted(
        new SphereGeometry(1, 28, 10)
          .scale(L * 0.4, H * 0.3, Wd * 0.34)
          .translate(0, H * 0.28, 0),
        [214, 180, 150],
      ),
    ),
    m.tissue,
  )
  markMesh(foot, 'Foot', true)
  body.add(foot)
  const gills: BufferGeometry[] = []
  for (let k = 0; k < 18; k++)
    for (const side of [-1, 1]) {
      const x = -L * 0.28 + (k / 17) * L * 0.5
      gills.push(
        tinted(
          new SphereGeometry(L * 0.012, 6, 4)
            .scale(1, 1.6, 0.6)
            .translate(x, H * 0.3, side * Wd * 0.38),
          [200, 120, 110],
        ),
      )
    }
  const gillMesh = new Mesh(own.geometry(merge(gills)), m.tissue)
  markMesh(gillMesh, 'Gill', true)
  body.add(gillMesh)
  body.add(marker('Radula', new Vector3(L * 0.36, H * 0.3, 0), true))
  return { shell, body, outside, buried: 0 }
}

/**
 * Common tusk shell (Antalis vulgaris): a slightly curved, tusk-shaped tube
 * open at both ends, white with fine lengthwise ridges and a brown-stained
 * narrow end; it lives buried head-down, only the narrow end in the water,
 * probing the sediment with club-tipped captacula (tusk-shell-appearance,
 * tusk-shell-burrowing, tusk-shell-captacula, scaphopod-parts).
 */
function tusk(L: number, own: Own, m: ClassMaterials): ClassAnimal {
  const shell = new Group()
  const body = new Group()
  const outside = new Group()
  // The axis: from the wide end (head, down in the sediment) curving up to the narrow end.
  const tilt = 0.95
  const axis = (t: number) => {
    const a = tilt + (t - 0.5) * 0.45
    return new Vector3(
      Math.cos(Math.PI / 2 - a) * L * (t - 0.5) * 0.98 +
        Math.sin(t * Math.PI) * L * 0.06,
      L * t * Math.cos(Math.PI / 2 - tilt) * 1.05,
      0,
    )
  }
  const radius = (t: number) => L * (0.055 - 0.042 * t)
  const tubeAt = (t: number, a: number, inset: number) => {
    const c = axis(t)
    const next = axis(Math.min(1, t + 0.01))
      .sub(axis(Math.max(0, t - 0.01)))
      .normalize()
    const side = new Vector3(0, 0, 1)
    const up = new Vector3().crossVectors(side, next).normalize()
    const r =
      radius(t) * (1 - inset) * (1 + 0.035 * Math.max(0, Math.sin(a * 22)) * t)
    return c
      .add(up.multiplyScalar(Math.cos(a) * r))
      .add(side.multiplyScalar(Math.sin(a) * r))
  }
  const outer = surface(
    48,
    40,
    (u, v) => tubeAt(u, v * TAU, 0),
    (u, v, p, out) => {
      linear([240, 236, 226], out)
      out.multiplyScalar(0.9 + 0.08 * Math.max(0, Math.sin(v * TAU * 22)) * u)
      out.lerp(linear([150, 96, 52]), smooth(0.82, 1, u) * 0.8)
      out.multiplyScalar(1 - 0.05 * Math.max(0, Math.sin(u * 60)))
      void p
    },
    true,
  )
  const outerMesh = new Mesh(own.geometry(outer), m.shell)
  markMesh(outerMesh, 'Tusk shell')
  shell.add(outerMesh)
  shell.add(
    new Mesh(
      own.geometry(
        surface(
          24,
          24,
          (u, v) => tubeAt(u, v * TAU, 0.18),
          (_u, _v, _p, out) => linear([244, 240, 232], out),
          true,
        ),
      ),
      m.inner,
    ),
  )
  shell.add(marker('Narrow end', axis(0.98)))
  // The mantle lining the tube, seen when it is cut open.
  const mantle = new Mesh(
    own.geometry(
      surface(
        20,
        16,
        (u, v) => tubeAt(0.05 + u * 0.85, v * TAU, 0.3),
        (_u, _v, _p, out) => linear([226, 196, 170], out),
        true,
      ),
    ),
    m.tissue,
  )
  markMesh(mantle, 'Mantle', true)
  body.add(mantle)
  // Out of the wide end: the digging foot and many club-tipped captacula probing the sediment.
  const mouth = axis(0)
  const down = axis(0).sub(axis(0.05)).normalize()
  const foot = new Mesh(
    own.geometry(
      strand(
        [
          mouth,
          mouth.clone().addScaledVector(down, L * 0.1),
          mouth
            .clone()
            .addScaledVector(down, L * 0.18)
            .add(new Vector3(0, -L * 0.02, 0)),
        ],
        L * 0.03,
        [226, 190, 160],
        0.55,
        8,
      ),
    ),
    m.tissue,
  )
  markMesh(foot, 'Foot')
  outside.add(foot)
  const random = seeded(2973)
  const threads: BufferGeometry[] = []
  for (let k = 0; k < 26; k++) {
    const spread = new Vector3(
      random() - 0.5,
      random() - 0.6,
      random() - 0.5,
    ).normalize()
    const reach = L * (0.12 + 0.18 * random())
    const p1 = mouth.clone().addScaledVector(down, L * 0.03)
    const p2 = p1
      .clone()
      .addScaledVector(spread.clone().add(down).normalize(), reach * 0.5)
    const p3 = p1.clone().addScaledVector(spread, reach)
    threads.push(strand([p1, p2, p3], L * 0.003, [236, 214, 196], 0.8, 3))
    threads.push(
      tinted(
        new SphereGeometry(L * 0.007, 5, 4).translate(p3.x, p3.y, p3.z),
        [240, 220, 200],
      ),
    )
  }
  const captacula = new Mesh(own.geometry(merge(threads)), m.tissue)
  markMesh(captacula, 'Captacula')
  outside.add(captacula)
  return { shell, body, outside, buried: 0.8 }
}

/**
 * Neopilina galatheae: a thin, almost circular cap-shaped shell with its apex
 * near the front edge, dull brown darkening to near black at the apex and pale
 * straw-brown at the edge, with growth lines and faint radial ribs; a round
 * foot beneath with five pairs of gills along each side (neopilina-appearance,
 * neopilina-serial-organs, monoplacophoran-parts).
 */
function cap(L: number, own: Own, m: ClassMaterials): ClassAnimal {
  const shell = new Group()
  const body = new Group()
  const outside = new Group()
  const R = L * 0.5
  const H = L * 0.3
  const apex = new Vector3(R * 0.7, H, 0)
  const at = (u: number, v: number) => {
    // u from the apex (0) to the margin (1); v around.
    const a = v * TAU
    const rim = new Vector3(Math.cos(a) * R, 0, Math.sin(a) * R * 0.92)
    const p = apex.clone().lerp(rim, u)
    p.y = H * Math.pow(1 - u, 1.35) + L * 0.01
    // Faint radial ribs and concentric growth lines.
    const rib = Math.sin(a * 44) * 0.004 * L * u
    p.x += Math.cos(a) * rib
    p.z += Math.sin(a) * rib
    p.y += Math.sin(u * 40) * L * 0.0025 * u
    return p
  }
  const outer = surface(
    30,
    64,
    at,
    (u, v, p, out) => {
      linear([200, 176, 128], out).lerp(
        linear([56, 40, 30]),
        smooth(0.6, 0.05, u),
      )
      // Corroded patches.
      out.multiplyScalar(0.85 + 0.2 * noise3(p.x * 0.5, p.z * 0.5, v))
    },
    true,
  )
  const outerMesh = new Mesh(own.geometry(outer), m.shell)
  markMesh(outerMesh, 'Cap shell')
  shell.add(outerMesh)
  shell.add(
    new Mesh(
      own.geometry(
        surface(
          16,
          48,
          (u, v) => at(u, v).addScaledVector(new Vector3(0, 1, 0), -L * 0.012),
          (_u, _v, _p, out) => linear([236, 232, 220], out),
          true,
        ),
      ),
      m.inner,
    ),
  )
  // A tiny coiled larval shell kept at the tip by one specimen (neopilina-unknowns).
  shell.add(
    marker('Larval shell', apex.clone().add(new Vector3(0, L * 0.01, 0))),
  )
  // The round foot and five pairs of gills in the groove beside it.
  const foot = new Mesh(
    own.geometry(
      tinted(
        new SphereGeometry(1, 28, 10)
          .scale(R * 0.62, L * 0.05, R * 0.58)
          .translate(-R * 0.05, L * 0.04, 0),
        [226, 206, 180],
      ),
    ),
    m.tissue,
  )
  markMesh(foot, 'Foot', true)
  body.add(foot)
  const gills: BufferGeometry[] = []
  for (let k = 0; k < 5; k++)
    for (const side of [-1, 1]) {
      const a = Math.PI * (0.35 + (k / 4) * 0.55)
      const x = -Math.cos(a) * R * 0.78
      const z = side * Math.sin(a) * R * 0.74
      for (let f = 0; f < 4; f++)
        gills.push(
          tinted(
            new SphereGeometry(L * 0.014, 6, 4)
              .scale(1.6, 0.5, 1)
              .translate(x + f * L * 0.008, L * 0.03, z),
            [220, 150, 130],
          ),
        )
    }
  const gillMesh = new Mesh(own.geometry(merge(gills)), m.tissue)
  markMesh(gillMesh, 'Gill', true)
  body.add(gillMesh)
  // The mouth's tentacle tufts just showing at the front, gathering detritus from the mud.
  const tufts: BufferGeometry[] = []
  for (let k = 0; k < 8; k++) {
    const z = (k / 7 - 0.5) * R * 0.5
    const base = new Vector3(R * 0.75, L * 0.015, z)
    tufts.push(
      strand(
        [base, base.clone().add(new Vector3(L * 0.04, -L * 0.006, z * 0.2))],
        L * 0.004,
        [230, 200, 170],
        0.5,
        3,
      ),
    )
  }
  const tuftMesh = new Mesh(own.geometry(merge(tufts)), m.tissue)
  markMesh(tuftMesh, 'Mouth tentacles')
  outside.add(tuftMesh)
  return { shell, body, outside, buried: 0 }
}

/** Merges small coloured pieces into one geometry. */
function merge(parts: BufferGeometry[]) {
  const positions: number[] = []
  const normals: number[] = []
  const colours: number[] = []
  const index: number[] = []
  for (const part of parts) {
    const g = part.index ? part : part
    if (!g.getAttribute('normal')) g.computeVertexNormals()
    const offset = positions.length / 3
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    const c = g.getAttribute('color')
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i))
      normals.push(n.getX(i), n.getY(i), n.getZ(i))
      colours.push(c ? c.getX(i) : 1, c ? c.getY(i) : 1, c ? c.getZ(i) : 1)
    }
    if (g.index)
      for (let i = 0; i < g.index.count; i++)
        index.push(g.index.getX(i) + offset)
    else for (let i = 0; i < p.count; i++) index.push(i + offset)
    part.dispose()
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
  geometry.setIndex(index)
  return geometry
}

/** Builds one of the other shelled classes at `size` of the adult (0–1). */
export function buildClassAnimal(
  kind: ClassKind,
  length: number,
  size: number,
  open: number,
  own: Own,
  materials: ClassMaterials,
): ClassAnimal {
  const L = length * Math.max(0.05, size)
  if (kind === 'clam') return clam(L, 0.08 + 0.1 * open, own, materials)
  if (kind === 'chiton') return chiton(L, own, materials)
  if (kind === 'tusk') return tusk(L, own, materials)
  return cap(L, own, materials)
}
