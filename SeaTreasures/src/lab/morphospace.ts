import { BufferGeometry, Float32BufferAttribute } from 'three'

/**
 * The six-parameter parametric shell surface of Contreras-Figueroa & Aragón
 * (2023), "A Mathematical Model for Mollusc Shells Based on Parametric
 * Surfaces and the Construction of Theoretical Morphospaces", Diversity 15(3),
 * 431 (CC BY 4.0). Written for SeaTreasures from the published equations:
 *
 *   λ(t, θ) = γ(t) + C(t, θ)
 *   γ(t)    = e^{bt} (d sin t, d cos t, z)
 *   C(t, θ) = e^{bt} (1 − 1/(t+1)) R_B(ψ)
 *             [(a sin θ cos φ + cos θ sin φ) N(t) + (a sin θ sin φ − cos θ cos φ) B(t)]
 *
 * with the Frenet frame {T, N, B} of γ, plus the paper's optional ornament
 * (aperture peaks n, rib frequency c) and hinge offset k for bivalves.
 */
export type ShellParams = {
  /** Whorl expansion rate. */
  b: number
  /** Distance of the generating curve from the coiling axis. */
  d: number
  /** Translation along the axis: 0 is planispiral. */
  z: number
  /** Aperture ratio (major to minor). */
  a: number
  /** Initial tilt of the aperture. */
  phi: number
  /** Rotation of the aperture around the local binormal. */
  psi: number
  /** Ornament: peaks around the aperture, ribs along growth, their amplitude, hinge offset. */
  n: number
  c: number
  orn: number
  k: number
  /** Revolutions shown. */
  turns: number
}

export type Preset = {
  id: string
  name: string
  scientificName: string
  group: 'Snails' | 'Limpets' | 'Cephalopods' | 'Bivalves'
  /** Whether the six shape parameters are from the paper's Table 1, or tuned here. */
  fromPaper: boolean
  params: ShellParams
  /** Bivalves are drawn as two mirrored valves. */
  valves?: 2
}

const base = { n: 0, c: 0, orn: 0.1, k: 0 }

/**
 * Shape parameters (b, d, z, a, φ, ψ, k) from Table 1 of the paper, as
 * published. `turns` sets how much is drawn, and the ornament added to the
 * wentletrap and ammonite is illustrative. The scallop is tuned here and is
 * marked as not from the paper.
 */
export const presets: Preset[] = [
  {
    id: 'asperiscala',
    name: 'Wentletrap',
    scientificName: 'Asperiscala pacis',
    group: 'Snails',
    fromPaper: true,
    params: {
      ...base,
      b: 0.0453,
      d: 0.7154,
      z: 5.8725,
      a: 0.8984,
      phi: 0.07113,
      psi: 0,
      c: 26,
      orn: 0.08,
      turns: 12,
    },
  },
  {
    id: 'acteon',
    name: 'Barrel bubble',
    scientificName: 'Acteon sullivanae',
    group: 'Snails',
    fromPaper: true,
    params: {
      ...base,
      b: 0.0658,
      d: 0.4258,
      z: 2.6922,
      a: 0.4542,
      phi: 0.2544,
      psi: 0,
      turns: 10,
    },
  },
  {
    id: 'lirularia',
    name: 'Top snail',
    scientificName: 'Lirularia pedroana',
    group: 'Snails',
    fromPaper: true,
    params: {
      ...base,
      b: 0.0922,
      d: 0.9172,
      z: 2.2916,
      a: 0.9483,
      phi: 0.1221,
      psi: 0,
      turns: 9,
    },
  },
  {
    id: 'brachysphingus',
    name: 'Whelk',
    scientificName: 'Brachysphingus mammilatus',
    group: 'Snails',
    fromPaper: true,
    params: {
      ...base,
      b: 0.0882,
      d: 0.4036,
      z: 1.5551,
      a: 0.6203,
      phi: 0.3001,
      psi: 0,
      turns: 9,
    },
  },
  {
    id: 'biplica',
    name: 'Agate snail',
    scientificName: 'Biplica obliqua',
    group: 'Snails',
    fromPaper: true,
    params: {
      ...base,
      b: 0.105,
      d: 0.3316,
      z: 1.1754,
      a: 0.8274,
      phi: 0.1196,
      psi: 0.6152,
      turns: 8,
    },
  },
  {
    id: 'scelidotoma',
    name: 'Keyhole limpet',
    scientificName: 'Scelidotoma bella',
    group: 'Limpets',
    fromPaper: true,
    params: {
      ...base,
      b: 7,
      d: 1.1292,
      z: 0,
      a: 1.7963,
      phi: 0,
      psi: 0.2,
      turns: 1.2,
    },
  },
  {
    id: 'crepidula',
    name: 'Slipper snail',
    scientificName: 'Crepidula adunca',
    group: 'Limpets',
    fromPaper: true,
    params: {
      ...base,
      b: 1.086,
      d: 1.3407,
      z: 0,
      a: 1.2335,
      phi: 0,
      psi: -0.8,
      k: 0.49,
      turns: 1.2,
    },
  },
  {
    id: 'nautilus',
    name: 'Nautilus',
    scientificName: 'Nautilus aff. N. cookanum',
    group: 'Cephalopods',
    fromPaper: true,
    params: {
      ...base,
      b: 0.1816,
      d: 0.9825,
      z: 0,
      a: 0.9036,
      phi: 0,
      psi: 0,
      turns: 5,
    },
  },
  {
    id: 'oregoniceras',
    name: 'Ammonite',
    scientificName: 'Oregoniceras siskiyouense',
    group: 'Cephalopods',
    fromPaper: true,
    params: {
      ...base,
      b: 0.1377,
      d: 2.406,
      z: 0,
      a: 1.3921,
      phi: 0,
      psi: 0,
      c: 30,
      orn: 0.06,
      turns: 5,
    },
  },
  {
    id: 'shasticrioceras',
    name: 'Uncoiled ammonite',
    scientificName: 'Shasticrioceras patricki',
    group: 'Cephalopods',
    fromPaper: true,
    params: {
      ...base,
      b: 0.1009,
      d: 3.07951,
      z: 0,
      a: 1.6098,
      phi: 0,
      psi: 0,
      turns: 3,
    },
  },
  {
    id: 'glycymerita',
    name: 'Bittersweet clam',
    scientificName: 'Glycymerita banosensis',
    group: 'Bivalves',
    fromPaper: true,
    valves: 2,
    params: {
      ...base,
      b: 0.7198,
      d: 0.8866,
      z: 0,
      a: 0.8567,
      phi: 0.0193,
      psi: -0.576,
      turns: 1.2,
    },
  },
  {
    id: 'cucullaea',
    name: 'Ark clam',
    scientificName: 'Cucullaea morani',
    group: 'Bivalves',
    fromPaper: true,
    valves: 2,
    params: {
      ...base,
      b: 0.7364,
      d: 0.8726,
      z: 0,
      a: 0.7293,
      phi: 0.193,
      psi: -0.666,
      k: 0.83,
      turns: 1.2,
    },
  },
  {
    id: 'scallop',
    name: 'Scallop',
    scientificName: 'Illustrative scallop (not in the paper)',
    group: 'Bivalves',
    fromPaper: false,
    valves: 2,
    params: {
      ...base,
      b: 0.736,
      d: 0.68,
      z: 0,
      a: 0.73,
      phi: 0.195,
      psi: -0.612,
      n: 21,
      orn: 0.1,
      k: -0.01,
      turns: 1.2,
    },
  },
]

export const paramInfo: {
  key: keyof ShellParams
  label: string
  min: number
  max: number
  step: number
  help: string
}[] = [
  {
    key: 'b',
    label: 'Whorl expansion',
    min: 0.02,
    max: 1.2,
    step: 0.005,
    help: 'How fast each turn grows. Small: many tight whorls; large: one widening cone.',
  },
  {
    key: 'd',
    label: 'Distance from axis',
    min: 0.1,
    max: 4,
    step: 0.01,
    help: 'How far the tube sits from the coiling axis: tight or open coiling.',
  },
  {
    key: 'z',
    label: 'Spire height',
    min: -3,
    max: 7,
    step: 0.05,
    help: 'How far each turn slides along the axis: 0 is flat like a nautilus, high is a tall spire.',
  },
  {
    key: 'a',
    label: 'Aperture shape',
    min: 0.3,
    max: 2.5,
    step: 0.01,
    help: 'The ratio of the opening: round near 1, long and narrow away from it.',
  },
  {
    key: 'phi',
    label: 'Aperture tilt',
    min: 0,
    max: 1.6,
    step: 0.01,
    help: 'Tilts the opening relative to the coil.',
  },
  {
    key: 'psi',
    label: 'Aperture turn',
    min: -1,
    max: 1,
    step: 0.01,
    help: 'Turns the opening to face along or across the direction of growth.',
  },
  {
    key: 'c',
    label: 'Ribs',
    min: 0,
    max: 40,
    step: 1,
    help: 'Ridges laid down along the growth, like growth lines made bold.',
  },
  {
    key: 'n',
    label: 'Edge peaks',
    min: 0,
    max: 30,
    step: 1,
    help: 'Folds around the opening: the radiating ribs of a scallop.',
  },
  {
    key: 'orn',
    label: 'Ornament depth',
    min: 0,
    max: 0.3,
    step: 0.01,
    help: 'How strong the ribs and peaks are.',
  },
  {
    key: 'turns',
    label: 'Turns drawn',
    min: 0.5,
    max: 14,
    step: 0.1,
    help: 'How much of the growth is drawn: grow the shell by turning this up.',
  },
]

/** A point on the shell surface (z up, as in the paper). */
export function surfacePoint(
  p: ShellParams,
  t: number,
  theta: number,
): [number, number, number] {
  const { b, d, z, a, phi, psi, n, c, orn, k } = p
  const ebt = Math.exp(b * t)
  const st = Math.sin(t)
  const ct = Math.cos(t)
  const tMag = Math.sqrt((b * b + 1) * d * d + b * b * z * z) || 1
  const T = [
    (d * (b * st + ct)) / tMag,
    (d * (b * ct - st)) / tMag,
    (b * z) / tMag,
  ]
  const nNorm = Math.sqrt(b * b + 1)
  const N = [(b * ct - st) / nNorm, (-b * st - ct) / nNorm, 0]
  const bMag =
    Math.sqrt((b * b + 1) * ((b * b + 1) * d * d + b * b * z * z)) || 1
  const B = [
    (b * z * (b * st + ct)) / bMag,
    (b * z * (b * ct - st)) / bMag,
    (d * (b * b + 1)) / bMag,
  ]
  const apex = 1 - 1 / (t + 1)
  const ribs = c > 0 ? 1 + orn * Math.sin(c * t) : 1
  const envelope = ebt * apex * ribs
  const sTh = Math.sin(theta)
  const cTh = Math.cos(theta)
  const peaks = n > 0 ? 1 + orn * Math.sin(n * theta) : 1
  const alpha = (a * sTh * Math.cos(phi) + cTh * Math.sin(phi)) * peaks
  const beta = (a * sTh * Math.sin(phi) - cTh * Math.cos(phi)) * peaks + k
  const wN = alpha * Math.cos(psi)
  const wT = alpha * Math.sin(psi)
  const x = ebt * d * st + envelope * (wN * N[0]! + wT * T[0]! + beta * B[0]!)
  const y = ebt * d * ct + envelope * (wN * N[1]! + wT * T[1]! + beta * B[1]!)
  const zz = ebt * z + envelope * (wN * N[2]! + wT * T[2]! + beta * B[2]!)
  return [x, y, zz]
}

export type Surface = {
  geometry: BufferGeometry
  /** Raw positions before centring and scaling, for tests and measurement. */
  extent: number
}

/**
 * A mesh of the shell, centred and scaled to `size`; the paper's z axis
 * becomes three.js y. `from` (in turns) skips the earliest growth: a bivalve
 * valve is only the last part of the coil, so drawing its whole history would
 * stack old, tiny margins inside it.
 */
export function shellSurface(
  p: ShellParams,
  size = 100,
  quality = 1,
  from = 0,
): Surface {
  const rows = Math.round(Math.min(900, Math.max(80, p.turns * 70)) * quality)
  const columns = Math.round(64 * quality)
  const tMax = Math.max(0.15, p.turns * Math.PI * 2)
  const tMin = Math.min(tMax - 0.1, Math.max(0.05, from * Math.PI * 2))
  const raw: number[] = []
  const uvs: number[] = []
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i <= rows; i++) {
    const t = tMin + ((tMax - tMin) * i) / rows
    for (let j = 0; j <= columns; j++) {
      const [x, y, zz] = surfacePoint(p, t, (j / columns) * Math.PI * 2)
      const v = [x, zz, y]
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis]!, v[axis]!)
        max[axis] = Math.max(max[axis]!, v[axis]!)
      }
      raw.push(v[0]!, v[1]!, v[2]!)
      uvs.push(i / rows, j / columns)
    }
  }
  const extent =
    Math.max(max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!) || 1
  const scale = size / extent
  const centre = [
    (min[0]! + max[0]!) / 2,
    (min[1]! + max[1]!) / 2,
    (min[2]! + max[2]!) / 2,
  ]
  const positions = raw.map(
    (value, index) => (value - centre[index % 3]!) * scale,
  )
  const indices: number[] = []
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < columns; j++) {
      const a = i * (columns + 1) + j
      const b = a + columns + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return { geometry, extent }
}
