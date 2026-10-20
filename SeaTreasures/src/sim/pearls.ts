import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  type Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Plane,
  SphereGeometry,
  SRGBColorSpace,
} from 'three'
import { fbm } from './kit.ts'

/**
 * Pearls, step by step: the intruder, the pearl sac around it, the first
 * layers, the pearl growing, and the largest known. Sizes are real
 * millimetres, drawn inside the animal at the same scale as its shell.
 */
export type PearlStep = {
  id: string
  /** A short name for the step, for the slider and the card. */
  name: string
  /** Diameter of the pearl (or the intruder before there is one), in millimetres. */
  mm: number
  /** What is happening, in a sentence, and the claims it rests on. */
  text: string
  claims: string[]
  /** A blister pearl grows against the shell and is fixed to it. */
  blister?: boolean
}

export type PearlKind = {
  /** Non-nacreous pearls are porcelain-like; nacreous ones shimmer. */
  nacre: boolean
  /** Background claims for the card, in order. */
  facts: string[]
  steps: PearlStep[]
}

export const pearls: Record<string, PearlKind> = {
  'giant-clam': {
    nacre: false,
    facts: [
      'giant-clam-pearl-kind',
      'pearl-not-sand',
      'pearl-any-mollusc',
      'giant-clam-pearl-growth-unknown',
    ],
    steps: [
      {
        id: 'intruder',
        name: 'Intruder',
        mm: 0.3,
        text: 'A parasite, a scrap of organic matter or an injury carries cells from the mantle’s outer layer into the soft body.',
        claims: ['pearl-natural-formation'],
      },
      {
        id: 'sac',
        name: 'Pearl sac',
        mm: 0.6,
        text: 'Those cells close into a pocket around it, the pearl sac, and start to coat it with calcium carbonate and conchiolin.',
        claims: ['pearl-natural-formation'],
      },
      {
        id: 'layers',
        name: 'First layers',
        mm: 1.5,
        text: 'Layer by layer the coat thickens, and the sac grows with it by cell division.',
        claims: ['pearl-concentric-layers'],
      },
      {
        id: 'turning',
        name: 'Growing',
        mm: 5,
        text: 'Most giant clam pearls are symmetrical around one axis, which suggests they slowly turn as they grow.',
        claims: ['giant-clam-pearl-rotation'],
      },
      {
        id: 'grown',
        name: 'Large pearl',
        mm: 15,
        text: 'A large loose giant clam pearl: these weigh up to several tens of carats, a few grams.',
        claims: ['giant-clam-pearl-sizes'],
      },
      {
        id: 'record',
        name: 'Record',
        mm: 240,
        text: 'The Pearl of Lao Tzu: 24 cm across and 6.4 kg, a blister pearl that grew against the shell and was cut from it.',
        claims: ['giant-clam-pearl-lao-tzu', 'giant-clam-pearl-sizes'],
        blister: true,
      },
    ],
  },
}

export const pearlFor = (speciesId: string) => pearls[speciesId] ?? null

type Own = {
  geometry<T extends BufferGeometry>(value: T): T
  material<T extends Material>(value: T): T
  texture(value: CanvasTexture): CanvasTexture
}

const TAU = Math.PI * 2

/** The pearl's radius in a direction: a little longer along its axis, lumpier as it grows large. */
function radius(x: number, y: number, z: number, lumps: number, seed: number) {
  const along = 1 + 0.07 * y * y
  return (
    along * (1 + lumps * fbm(x * 1.6 + seed, y * 1.6 + seed, z * 1.6 + seed, 3))
  )
}

/** Flames: long tapering streaks around the pearl's axis (u runs round it, v pole to pole). */
function flameTexture(own: Own) {
  const W = 256
  const H = 128
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const context = canvas.getContext('2d')!
  const image = context.createImageData(W, H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = x / W
      const v = y / H
      // Narrow flames whose bases sit at the equator and tips reach towards the poles.
      const lean = Math.abs(v - 0.5) * 2
      const flame = Math.sin(u * TAU * 22 + Math.sin(v * 9) * 0.6 + lean * 1.4)
      const taper = Math.pow(Math.max(0, flame), 2 + lean * 6)
      const cloud = fbm(u * 8, v * 6, 0.3, 2) * 0.5 + 0.5
      const light = 236 + taper * 18 - cloud * 10
      const i = (y * W + x) * 4
      image.data[i] = Math.min(255, light + 4)
      image.data[i + 1] = Math.min(255, light)
      image.data[i + 2] = Math.min(255, light - 10)
      image.data[i + 3] = 255
    }
  context.putImageData(image, 0, 0)
  const map = own.texture(new CanvasTexture(canvas))
  map.colorSpace = SRGBColorSpace
  return map
}

/** Concentric growth rings for the cut face: a dark centre, then bands out to the skin. */
function ringTexture(own: Own, rings: number, core: number) {
  const W = 512
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = 2
  const context = canvas.getContext('2d')!
  for (let x = 0; x < W; x++) {
    const u = x / (W - 1)
    let shade: [number, number, number]
    if (u < core) shade = [120, 92, 70]
    else {
      const t = (u - core) / (1 - core)
      const band = (t * rings) % 1
      // A thin brownish line of organic matter between each lighter mineral layer.
      shade =
        band < 0.12 ? [196, 182, 160] : [244 - (band > 0.6 ? 6 : 0), 238, 226]
    }
    context.fillStyle = `rgb(${shade.join(',')})`
    context.fillRect(x, 0, 1, 2)
  }
  const map = own.texture(new CanvasTexture(canvas))
  map.colorSpace = SRGBColorSpace
  return map
}

/** The cut face at z = 0, following the pearl's outline, with rings that follow it too. */
function cutFace(R: number, lumps: number, seed: number) {
  const N = 72
  const M = 24
  const positions: number[] = []
  const uvs: number[] = []
  const normals: number[] = []
  const index: number[] = []
  for (let j = 0; j <= M; j++)
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU
      const x = Math.cos(a)
      const y = Math.sin(a)
      const r = R * radius(x, y, 0, lumps, seed) * (j / M)
      positions.push(x * r, y * r, 0)
      uvs.push(j / M, 0.5)
      normals.push(0, 0, 1)
    }
  for (let j = 0; j < M; j++)
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i
      const b = a + N + 1
      index.push(a, b, a + 1, a + 1, b, b + 1)
    }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setIndex(index)
  return geometry
}

/**
 * The pearl at one step, centred on its own origin with its axis up. With
 * `cut` it is halved by the figure's cut plane and shows its growth rings.
 */
export function buildPearl(
  kind: PearlKind,
  step: number,
  own: Own,
  options: { cut: boolean; clipping: Plane[] },
) {
  const group = new Group()
  group.name = 'pearl'
  const at = kind.steps[Math.max(0, Math.min(kind.steps.length - 1, step))]!
  const seed = 3.7
  const intruder = kind.steps[0]!.mm
  const loose = !at.blister
  const pearlMm = at.id === 'intruder' || at.id === 'sac' ? 0 : at.mm
  const lumps = at.blister ? 0.16 : pearlMm > 10 ? 0.05 : 0.03

  // The intruder: a small dark, irregular speck; inside the pearl from then on.
  if (loose) {
    const speck = own.geometry(new SphereGeometry(intruder / 2, 20, 14))
    const p = speck.getAttribute('position')
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const y = p.getY(i)
      const z = p.getZ(i)
      const s = 1 + 0.35 * fbm(x * 9 + 1, y * 9, z * 9, 2)
      p.setXYZ(i, x * s * 1.3, y * s * 0.8, z * s)
    }
    speck.computeVertexNormals()
    const mesh = new Mesh(
      speck,
      own.material(
        new MeshStandardMaterial({ color: 0x6b4a36, roughness: 0.8 }),
      ),
    )
    // Once coated it is hidden inside the pearl, until the pearl is cut open.
    if (pearlMm > 0 && !options.cut) mesh.visible = false
    else mesh.userData.label = 'Intruder'
    group.add(mesh)
  }

  if (pearlMm > 0) {
    const R = pearlMm / 2
    const geometry = own.geometry(new SphereGeometry(1, 96, 64))
    const p = geometry.getAttribute('position')
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const y = p.getY(i)
      const z = p.getZ(i)
      const r = R * radius(x, y, z, lumps, seed)
      p.setXYZ(i, x * r, y * r, z * r)
    }
    geometry.computeVertexNormals()
    const skin = own.material(
      new MeshPhysicalMaterial({
        color: kind.nacre ? 0xf4ece4 : 0xfbf6ec,
        map: kind.nacre ? null : flameTexture(own),
        roughness: kind.nacre ? 0.12 : 0.3,
        clearcoat: 0.8,
        clearcoatRoughness: 0.2,
        sheen: kind.nacre ? 0 : 0.6,
        sheenColor: 0xffffff,
        sheenRoughness: 0.4,
        iridescence: kind.nacre ? 1 : 0,
        iridescenceThicknessRange: [300, 700],
        side: DoubleSide,
        clippingPlanes: options.clipping,
      }),
    )
    // A pearl is bright and glossy: more of the studio light shows in it than in the shell.
    skin.userData.reflect = 1.4
    skin.emissive.set(0x2a2622)
    const pearl = new Mesh(geometry, skin)
    pearl.userData.label = at.blister ? 'Blister pearl' : 'Pearl'
    group.add(pearl)
    if (options.cut) {
      const core = loose ? Math.min(0.5, intruder / pearlMm) : 0.08
      const rings = Math.round(Math.min(26, 3 + Math.log2(pearlMm / 0.6) * 4))
      const face = new Mesh(
        own.geometry(cutFace(R, lumps, seed)),
        own.material(
          new MeshStandardMaterial({
            map: ringTexture(own, rings, core),
            roughness: 0.55,
          }),
        ),
      )
      face.position.z = R * 0.0005
      face.userData.label = 'Growth layers'
      group.add(face)
    }
  }

  // The pearl sac: a thin translucent pocket of mantle cells around the loose pearl.
  if (loose && at.id !== 'intruder') {
    const R = Math.max(intruder * 0.9, (pearlMm || intruder) / 2) * 1.18
    const sac = new Mesh(
      own.geometry(new SphereGeometry(R, 40, 28)),
      own.material(
        new MeshPhysicalMaterial({
          color: 0xe9b9a6,
          roughness: 0.5,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
          side: DoubleSide,
          clippingPlanes: options.clipping,
        }),
      ),
    )
    sac.scale.y = 1.07
    sac.renderOrder = 3
    sac.userData.label = 'Pearl sac'
    group.add(sac)
  }
  return { group, step: at, size: Math.max(at.mm, intruder) }
}
