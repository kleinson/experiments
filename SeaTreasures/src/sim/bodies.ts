import {
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  Group,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from 'three'
import type { Rgb } from './patterns.ts'
import { seeded } from './patterns.ts'

/**
 * Soft bodies for the living molluscs. Colours and features follow each
 * species' sourced description (see `skins`); shapes are illustrations.
 */
export type Skin = {
  /** Base colour of the skin. */
  base: Rgb
  /** Mottle colour laid over it in soft blotches. */
  mottle: Rgb
  /** How much of the skin is mottled, 0–1. */
  amount: number
  /** Stripes across the skin (the money cowrie's zebra-like mantle). */
  stripes?: Rgb
  /** Colour of the sole under the foot. */
  sole: Rgb
  /** Banded colours for the siphon (the textile cone's black and red). */
  siphonBands?: [Rgb, Rgb]
}

export const skins: Record<string, Skin> = {
  // cowrie-animal-anatomy: mantle lobes with short papillae.
  'tiger-cowrie': {
    base: [128, 96, 74],
    mottle: [62, 44, 36],
    amount: 0.45,
    sole: [196, 170, 146],
  },
  // money-cowrie-pattern: the mantle shows a mottled or zebra-like black-and-white pattern.
  'money-cowrie': {
    base: [226, 222, 212],
    mottle: [40, 38, 36],
    amount: 0.3,
    stripes: [34, 32, 30],
    sole: [214, 206, 192],
  },
  // textile-cone-size-pattern: white mottled with tan; siphon banded black and red.
  'textile-cone': {
    base: [236, 228, 214],
    mottle: [176, 140, 98],
    amount: 0.5,
    sole: [226, 214, 196],
    siphonBands: [
      [34, 28, 26],
      [190, 44, 40],
    ],
  },
  // queen-conch-appearance: no skin colour is sourced; a neutral grey-brown is used.
  'queen-conch': {
    base: [150, 128, 104],
    mottle: [96, 78, 62],
    amount: 0.5,
    sole: [184, 164, 140],
  },
  // nautilus-appearance: no skin colour is sourced; a neutral pale tan is used.
  'chambered-nautilus': {
    base: [222, 196, 170],
    mottle: [176, 136, 108],
    amount: 0.35,
    sole: [222, 196, 170],
  },
}

const skinCache = new Map<string, CanvasTexture>()

/** A wet, mottled skin texture, seeded per species so it never changes between frames. */
function skinTexture(id: string, skin: Skin) {
  const cached = skinCache.get(id)
  if (cached) return cached
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('The skin could not be drawn.')
  const rgb = (c: Rgb, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
  context.fillStyle = rgb(skin.base)
  context.fillRect(0, 0, size, size)
  const random = seeded(id.length * 977 + 13)
  for (let i = 0; i < 420 * skin.amount; i++) {
    const x = random() * size
    const y = random() * size
    const r = 3 + random() * 16
    const gradient = context.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, rgb(skin.mottle, 0.55 * random() + 0.15))
    gradient.addColorStop(1, rgb(skin.mottle, 0))
    context.fillStyle = gradient
    for (const dx of [-size, 0, size])
      for (const dy of [-size, 0, size]) {
        context.save()
        context.translate(dx, dy)
        context.beginPath()
        context.arc(x, y, r, 0, Math.PI * 2)
        context.fill()
        context.restore()
      }
  }
  if (skin.stripes) {
    context.strokeStyle = rgb(skin.stripes, 0.75)
    for (let i = 0; i < 18; i++) {
      context.lineWidth = 2 + random() * 6
      const y = (i / 18) * size + random() * 8
      context.beginPath()
      context.moveTo(0, y)
      for (let x = 0; x <= size; x += 16)
        context.lineTo(x, y + Math.sin(x * 0.05 + i) * 6)
      context.stroke()
    }
  }
  for (let i = 0; i < 2600; i++) {
    context.fillStyle = rgb(
      random() > 0.5 ? [255, 255, 255] : skin.mottle,
      0.06,
    )
    context.fillRect(random() * size, random() * size, 1.4, 1.4)
  }
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  map.wrapS = map.wrapT = RepeatWrapping
  skinCache.set(id, map)
  return map
}

export function skinMaterials(id: string, opacity: number) {
  const skin = skins[id] ?? skins['queen-conch']!
  const fade = { transparent: opacity < 1, opacity }
  const wet = {
    roughness: 0.38,
    clearcoat: 0.55,
    clearcoatRoughness: 0.25,
    sheen: 0.5,
  }
  const map = skinTexture(id, skin)
  const flesh = new MeshPhysicalMaterial({
    map,
    ...wet,
    ...fade,
    sheenColor: new Color(1, 0.95, 0.9),
  })
  const sole = new MeshPhysicalMaterial({
    color: new Color(...(skin.sole.map((c) => c / 255) as Rgb)),
    roughness: 0.5,
    clearcoat: 0.4,
    ...fade,
  })
  const eye = new MeshPhysicalMaterial({
    color: new Color(0.05, 0.04, 0.04),
    roughness: 0.08,
    clearcoat: 1,
    ...fade,
  })
  const bands = skin.siphonBands?.map(
    (band) =>
      new MeshPhysicalMaterial({
        color: new Color(...(band.map((c) => c / 255) as Rgb)),
        ...wet,
        ...fade,
      }),
  )
  return { flesh, sole, eye, bands }
}

/**
 * A tube that narrows to a rounded tip, along any curve, with a gentle swell:
 * tentacles, eye stalks, siphons and proboscis.
 */
export function limb(
  points: Vector3[],
  radius: number,
  tip = 0.25,
  segments = 28,
) {
  const curve = new CatmullRomCurve3(points)
  const geometry = new TubeGeometry(curve, segments, radius, 12, false)
  const position = geometry.getAttribute('position')
  for (let ring = 0; ring <= segments; ring++) {
    const t = ring / segments
    const centre = curve.getPoint(t)
    const keep =
      (1 - (1 - tip) * Math.pow(t, 1.3)) * (1 + 0.08 * Math.sin(t * Math.PI))
    for (let k = 0; k <= 12; k++) {
      const index = ring * 13 + k
      const p = new Vector3()
        .fromBufferAttribute(position, index)
        .sub(centre)
        .multiplyScalar(keep)
        .add(centre)
      position.setXYZ(index, p.x, p.y, p.z)
    }
  }
  geometry.computeVertexNormals()
  return geometry
}

/** A rounded cap that closes the end of a limb. */
export function cap(point: Vector3, radius: number) {
  const geometry = new SphereGeometry(radius, 14, 10)
  geometry.translate(point.x, point.y, point.z)
  return geometry
}

/**
 * The snail's foot and head as one soft surface: a flattened, rounded slug
 * shape whose underside is a flat creeping sole, wider at the back and
 * tapering toward the head, with a raised neck that leads into the shell.
 * Length runs along +x; the sole sits at y = 0.
 */
export function footGeometry(
  length: number,
  width: number,
  height: number,
  segments = 48,
  around = 28,
) {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= segments; i++) {
    const u = i / segments
    const x = (u - 0.5) * length
    // Wider behind the middle, rounded at both ends.
    const profile = Math.sin(Math.PI * Math.pow(u, 0.85))
    const w = width * 0.5 * Math.pow(profile, 0.55) * (0.78 + 0.22 * (1 - u))
    const h =
      height *
      Math.pow(profile, 0.7) *
      (0.7 + 0.5 * Math.exp(-Math.pow((u - 0.72) / 0.16, 2)))
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2
      const s = Math.sin(a)
      const c = Math.cos(a)
      // Upper half is a dome; lower half is pressed flat into a sole with a soft rim.
      const y =
        s >= 0
          ? h * Math.pow(s, 0.8)
          : -Math.min(h * 0.08, height * 0.05) * Math.pow(-s, 3)
      const z =
        w * Math.sign(c) * Math.pow(Math.abs(c), 0.85) * (s < 0 ? 1.04 : 1)
      positions.push(x, Math.max(0, y + h * 0.06), z)
      uvs.push(u * 3, j / around)
      if (i < segments && j < around) {
        const a0 = i * (around + 1) + j
        const b0 = a0 + around + 1
        indices.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Short, soft papillae scattered over a mantle surface (cowrie-animal-anatomy). */
export function papillae(
  surface: (u: number, v: number) => { point: Vector3; normal: Vector3 },
  count: number,
  size: number,
  seed: number,
) {
  const random = seeded(seed)
  const parts: BufferGeometry[] = []
  for (let i = 0; i < count; i++) {
    const { point, normal } = surface(random(), random())
    const tip = point
      .clone()
      .addScaledVector(normal, size * (0.8 + random() * 0.8))
    const bend = point
      .clone()
      .lerp(tip, 0.5)
      .add(
        new Vector3(
          (random() - 0.5) * size * 0.4,
          0,
          (random() - 0.5) * size * 0.4,
        ),
      )
    parts.push(limb([point, bend, tip], size * 0.28, 0.35, 5))
  }
  return parts
}

/** Builds meshes for a list of geometries with one material, tracking them for disposal. */
export function meshes(
  geometries: BufferGeometry[],
  material: Material,
  own: (g: BufferGeometry) => BufferGeometry,
) {
  const group = new Group()
  for (const geometry of geometries)
    group.add(new Mesh(own(geometry), material))
  return group
}
