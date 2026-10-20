import {
  BufferGeometry,
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  Float32BufferAttribute,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Points,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
} from 'three'
import type { WebGLProgramParametersWithUniforms } from 'three'
import { seeded } from './patterns.ts'
import type { Rgb } from './patterns.ts'
import type { Setting } from './seabed.ts'
import { daylightAt } from './depth.ts'
import { buildFish } from './fish.ts'

/**
 * Light under water: what makes the seabed read as the sea floor rather than
 * a table top. Shared uniforms drive every patched material, so one update per
 * frame animates the whole scene.
 *
 * - Caustics: sunlight focused by surface waves into moving bright webs on
 *   everything that faces up, fading with depth.
 * - Absorption: water absorbs red first, so distant things turn blue-green
 *   and fade into the water colour.
 */
export const water = {
  time: { value: 0 },
  /** Strength of the caustic light, 0 to switch off. */
  caustics: { value: 1 },
  /** World size of one caustic cell. */
  scale: { value: 40 },
  /** Water colour things fade into, linear RGB. */
  colour: { value: new Color(0.2, 0.45, 0.55) },
  /** Distance from the camera target over which the water swallows the scene. */
  near: { value: 200 },
  far: { value: 2000 },
  /** World point the fade is measured from (the specimen). */
  centre: { value: new Vector3() },
  /**
   * A see-through window in the sand over a buried animal: centre (xyz) and
   * radius (w). A radius of 0 closes it.
   */
  window: { value: new Vector4() },
  /** The water's colour cast on everything in it, per channel: red goes first. */
  cast: { value: new Color(1, 1, 1) },
}

/** Over a buried animal the sand turns to frosted glass, edged by a faint rim, so it can be followed. */
const WINDOW = /* glsl */ `
  if (stWindow.w > 0.0) {
    float stR = length(stWorld.xz - stWindow.xz) / stWindow.w;
    // Just thin enough to see the animal: a soft-edged patch, no ring.
    float stInside = 1.0 - smoothstep(0.45, 1.0, stR);
    diffuseColor.a *= mix(1.0, 0.42, stInside);
  }`

/**
 * The sand window alone, for the drawn look's ground, which is not lit by the
 * water's shader. Returns the material.
 */
export function windowed(material: Material) {
  material.transparent = true
  const previous = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer)
    shader.uniforms.stWindow = water.window
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 stWorld;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        stWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec4 stWindow;\nvarying vec3 stWorld;',
      )
      .replace(
        '#include <opaque_fragment>',
        `${WINDOW}\n#include <opaque_fragment>`,
      )
  }
  const key = material.customProgramCacheKey?.bind(material)
  material.customProgramCacheKey = () => `${key?.() ?? ''}|sand-window`
  material.needsUpdate = true
  return material
}

/**
 * The caustic web, drawn once into a small tileable texture: bright where
 * Voronoi cells meet, which is how light focused by surface waves looks on
 * sand. The shader slides two copies of it across each other, which costs two
 * texture reads instead of evaluating the cells for every pixel.
 */
let causticMap: DataTexture | null = null
function caustics() {
  if (causticMap) return causticMap
  const size = 256
  const cells = 6
  const random = seeded(31)
  const points = Array.from({ length: cells * cells }, () => [
    0.12 + 0.76 * random(),
    0.12 + 0.76 * random(),
  ])
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = (x / size) * cells
      const py = (y / size) * cells
      const cx = Math.floor(px)
      const cy = Math.floor(py)
      let first = 9
      let second = 9
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const gx = cx + i
          const gy = cy + j
          const point =
            points[
              (((gy % cells) + cells) % cells) * cells +
                (((gx % cells) + cells) % cells)
            ]!
          const d = Math.hypot(gx + point[0]! - px, gy + point[1]! - py)
          if (d < first) {
            second = first
            first = d
          } else if (d < second) second = d
        }
      const edge = Math.max(0, 1 - (second - first) / 0.16)
      const value = Math.round(255 * edge * edge * (3 - 2 * edge))
      const k = (y * size + x) * 4
      data[k] = data[k + 1] = data[k + 2] = value
      data[k + 3] = 255
    }
  causticMap = new DataTexture(data, size, size)
  causticMap.wrapS = causticMap.wrapT = RepeatWrapping
  causticMap.magFilter = LinearFilter
  causticMap.minFilter = LinearMipmapLinearFilter
  causticMap.generateMipmaps = true
  causticMap.needsUpdate = true
  return causticMap
}

/**
 * Adds caustics and water absorption to a lit material. Idempotent. `near`
 * (for the specimen) keeps it out of the distance fade and dims its caustics,
 * so the subject keeps its true colours.
 */
export function underwater(material: Material, near = false) {
  if (material.userData.underwater) return material
  material.userData.underwater = true
  const strength = near ? '0.35' : '1.0'
  const fades = near ? '0.0' : '1.0'
  const previous = material.onBeforeCompile
  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer,
  ) => {
    previous?.call(material, shader, renderer)
    shader.uniforms.stTime = water.time
    shader.uniforms.stCaustics = water.caustics
    shader.uniforms.stCausticMap = { value: caustics() }
    shader.uniforms.stScale = water.scale
    shader.uniforms.stWater = water.colour
    shader.uniforms.stNear = water.near
    shader.uniforms.stFar = water.far
    shader.uniforms.stCentre = water.centre
    shader.uniforms.stCast = water.cast
    shader.uniforms.stWindow = water.window
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 stWorld;\nvarying vec3 stNormalW;',
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
          stWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          stWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif
        stNormalW = normalize(mat3(modelMatrix) * objectNormal);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float stTime;
        uniform float stCaustics;
        uniform float stScale;
        uniform vec3 stWater;
        uniform float stNear;
        uniform float stFar;
        uniform vec3 stCentre;
        uniform vec4 stWindow;
        uniform vec3 stCast;
        uniform sampler2D stCausticMap;
        varying vec3 stWorld;
        varying vec3 stNormalW;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `
        {
          vec2 q = stWorld.xz / stScale;
          float t = stTime * 0.6;
          // Two layers of the web drifting across each other: where they cross, the light focuses.
          float c1 = texture2D(stCausticMap, q / 6.0 + vec2(t * 0.018, t * 0.012)).r;
          float c2 = texture2D(stCausticMap, q / 3.5 - vec2(t * 0.011, t * 0.016) + 0.37).r;
          float c = min(c1, c2) * 1.4 + (c1 + c2) * 0.18;
          float up = smoothstep(-0.1, 0.8, stNormalW.y);
          outgoingLight += diffuseColor.rgb * vec3(0.55, 0.62, 0.65) * c * up * stCaustics * ${strength};
          // The water tints everything in it, as in photographs taken there; the specimen a little less.
          outgoingLight *= mix(vec3(1.0), stCast, ${near ? '0.7' : '1.0'});
          // Absorption: red fades first, then everything sinks into the water colour.
          float d = length(stWorld - stCentre);
          float fade = smoothstep(stNear, stFar, d) * ${fades};
          outgoingLight *= mix(vec3(1.0), vec3(0.78, 0.92, 0.98), smoothstep(stNear * 0.5, stFar, d) * ${fades});
          outgoingLight = mix(outgoingLight, stWater, fade);
          // The far seabed dissolves into the water behind the canvas: no hard horizon.
          ${material.userData.horizon ? 'diffuseColor.a *= 1.0 - smoothstep(stFar * 0.8, stFar * 1.15, length(stWorld.xz - stCentre.xz));' : ''}
          ${material.userData.horizon ? WINDOW : ''}
        }
        #include <opaque_fragment>`,
      )
  }
  const key = material.customProgramCacheKey?.bind(material)
  material.customProgramCacheKey = () =>
    `${key?.() ?? ''}|underwater${near ? '-near' : ''}`
  material.needsUpdate = true
  return material
}

/** Sets the water colour and how far one can see, from the setting. */
export type WaterLight = {
  /** Background water colour, sRGB 0–255. */
  tone: Rgb
  /** How much daylight reaches the animal, 0–1. */
  daylight: number
  night: boolean
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]
const DEEP_BLUE: Rgb = [6, 26, 62]
const NIGHT: Rgb = [4, 10, 24]

/**
 * Sets the water from the place, the depth and the time of day. Red light is
 * absorbed first and daylight fades with depth (water-light-depth), so deeper
 * water is bluer and darker; at night only the diver's torch lights the scene.
 */
export function waterFor(
  setting: Setting,
  extent: number,
  night: boolean,
): WaterLight {
  const { place } = setting
  const depth = setting.depthM
  const daylight =
    setting.scene === 'beach' ? 1 : daylightAt(depth, place.clarity)
  const base: Rgb =
    setting.scene === 'beach'
      ? [170, 205, 215]
      : setting.scene === 'open-water'
        ? mix(place.water, [60, 150, 180], 0.4)
        : place.water
  // Deeper: towards deep blue and darker. Night: almost black, a hint of moonlit blue.
  let tone = mix(base, DEEP_BLUE, 1 - daylight)
  tone = tone.map((c) => c * (0.45 + 0.55 * daylight)) as Rgb
  if (night) tone = mix(tone, NIGHT, 0.85)
  water.colour.value.setRGB(
    (tone[0] / 255) ** 2.2,
    (tone[1] / 255) ** 2.2,
    (tone[2] / 255) ** 2.2,
  )
  // The cast was measured from photos at about 8 m: weaker in the shallows, stronger deeper down.
  const cast = place.cast ?? [1, 1, 1]
  // The cast was measured from whole photographs taken at about 8 m: weaker in the
  // shallows, stronger deeper down, gone on the beach and under a diver's torch.
  const strength =
    setting.scene === 'beach' || night
      ? 0
      : Math.min(1.6, Math.max(0.5, depth / 8))
  water.cast.value.setRGB(
    cast[0] ** strength,
    cast[1] ** strength,
    cast[2] ** strength,
  )
  water.scale.value = extent * 0.55
  // Caustics fade fast with depth: bright webs in the shallows, gone by about 30 m.
  water.caustics.value =
    setting.scene === 'beach' || night
      ? 0
      : 0.9 * Math.exp(-depth / 16) * (setting.main === 'kelp' ? 0.6 : 1)
  const reach = 0.6 + 0.6 * place.clarity
  water.near.value = extent * (night ? 1.2 : 2.5 * reach)
  water.far.value =
    extent * (night ? 4.5 : Math.max(5, 11.5 * reach * (0.5 + 0.5 * daylight)))
  return {
    tone: tone.map((c) => Math.round(c)) as Rgb,
    daylight,
    night,
  }
}

/**
 * The water around the seabed: the surface seen from below, shafts of light
 * and a few small fish. Returns its own animate and dispose.
 */
export function buildWater(
  setting: Setting,
  extent: number,
  seed: number,
  life: { feed: Vector3[]; sand: Vector3[]; homes: Vector3[] } | null = null,
  avoid: Vector3 = new Vector3(),
) {
  const disposers: (() => void)[] = []
  const group = new Group()
  group.name = 'water'
  const geometries: BufferGeometry[] = []
  const materials: Material[] = []
  const own = <T extends BufferGeometry>(g: T) => (geometries.push(g), g)
  const mat = <T extends Material>(m: T) => (materials.push(m), m)
  const random = seeded(seed)
  const E = extent
  const deep = (setting.mix.deep ?? 0) > 0.3
  const updates: ((t: number) => void)[] = []

  if (setting.scene !== 'beach') {
    // The surface, the sun and its shafts are drawn behind the scene (sky.ts): an orthographic
    // camera would draw a surface plane across the whole view.
    // Reef fish of familiar kinds, schooling, grazing and resting (fish.ts). None in the deep
    // or on a deep slope, and they are hidden on a night dive.
    if (!deep && setting.depthM <= 60 && life) {
      const fishLife = buildFish(
        setting.place.reef,
        // The seabed's own layout (seafloor.ts), so fish keep their real size beside a small shell.
        Math.max(E, 300),
        random,
        life.feed,
        life.sand,
        life.homes,
        setting.scene === 'open-water' ? 0.5 : 1,
      )
      for (const mesh of fishLife.meshes) {
        underwater(mesh.material as Material)
        group.add(mesh)
      }
      disposers.push(fishLife.dispose)
      updates.push((t) => fishLife.animate(t, avoid))
    }
  }

  // Marine snow: flakes of drifting organic matter and fine silt, sinking slowly through the
  // light. They are moved on the GPU, so a few thousand cost nothing on the CPU, and drawn at
  // their real size (0.1 to 3 mm) unless that is under a pixel.
  let snowLight: ((day: number) => void) | null = null
  let snowView: ((width: number, height: number) => void) | null = null
  if (setting.scene !== 'beach') {
    const count = deep ? 1600 : 1300
    // The box is fitted to the view every frame (see `view`), so it is as full when looking at a
    // 1 mm larva as at a metre of reef. Positions are stored as fractions of it.
    const box = new Vector3(E * 12, E * 8, E * 12)
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = random() - 0.5
      positions[i * 3 + 1] = random() - 0.5
      positions[i * 3 + 2] = random() - 0.5
      // Mostly fine silt and plankton, about a quarter larger flakes of marine snow.
      const flake = random() < 0.28
      sizes[i] = flake ? 0.5 + random() ** 2 * 2.5 : 0.1 + random() * 0.3
      seeds[i] = random()
    }
    const geometry = own(new BufferGeometry())
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1))
    geometry.setAttribute('seed', new Float32BufferAttribute(seeds, 1))
    const uniforms = {
      time: { value: 0 },
      viewH: { value: 800 },
      box: { value: box },
      // The box wraps round what the camera looks at, so the snow always fills the view.
      centre: water.centre,
      // Real speeds in mm/s: marine snow sinks about 1 mm/s (tens of metres a day); the current
      // carries it sideways a little faster and the swell rocks it.
      sink: { value: 0.9 },
      drift: { value: 6 },
      sway: { value: 20 },
      light: { value: 1 },
    }
    const material = mat(
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms,
        vertexShader: /* glsl */ `
          uniform float time, viewH, sink, drift, sway, light;
          uniform vec3 box, centre;
          attribute float size;
          attribute float seed;
          varying float vAlpha;
          void main() {
            vec3 p = position * box;
            float pace = 0.5 + seed;
            p.y -= time * sink * pace;
            p.x += time * drift + sin(time * 0.35 + seed * 40.0) * sway;
            p.z += cos(time * 0.28 + seed * 31.0) * sway * 0.7;
            vec3 halfBox = box * 0.5;
            p = mod(p - centre + halfBox, box) - halfBox;
            vec4 view = modelViewMatrix * vec4(p + centre, 1.0);
            gl_Position = projectionMatrix * view;
            float px = size * projectionMatrix[1][1] * viewH * 0.5;
            gl_PointSize = clamp(px, 2.6, 16.0);
            // Fade in and out at the edges of the box, so wrapping round never pops.
            vec3 edge = abs(p / halfBox);
            float fade = (1.0 - smoothstep(0.75, 1.0, edge.x))
              * (1.0 - smoothstep(0.75, 1.0, edge.y))
              * (1.0 - smoothstep(0.75, 1.0, edge.z));
            vAlpha = fade * light * (0.55 + 0.4 * seed);
          }`,
        fragmentShader: /* glsl */ `
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            // A bright core in a soft halo: a flake catching the light.
            float a = (smoothstep(0.5, 0.05, d) * 0.55 + smoothstep(0.22, 0.0, d) * 0.45) * vAlpha;
            gl_FragColor = vec4(vec3(0.97, 0.98, 0.94), a);
          }`,
      }),
    )
    const snow = new Points(geometry, material)
    const buffer = new Vector2()
    snow.onBeforeRender = (renderer) => {
      uniforms.viewH.value = renderer.getDrawingBufferSize(buffer).y
    }
    snow.userData.noInk = true
    snow.frustumCulled = false
    snow.renderOrder = 3
    group.add(snow)
    updates.push((t) => (uniforms.time.value = t))
    snowLight = (day) => (uniforms.light.value = 0.35 + 0.65 * day)
    snowView = (width, height) => {
      box.set(width * 1.4, height * 1.6, width * 1.4)
      // The swell's sway is real (about 20 mm) but kept inside a small box.
      uniforms.sway.value = Math.min(20, width * 0.05)
      uniforms.drift.value = Math.min(6, width * 0.02)
    }
  }

  const animate = (t: number) => updates.forEach((update) => update(t))
  animate(0)
  return {
    group,
    animate,
    /** Dims the snow with the daylight that reaches it. */
    light(day: number) {
      snowLight?.(day)
    },
    /** Fits the snow to the visible water, in mm. */
    view(width: number, height: number) {
      snowView?.(width, height)
    },
    dispose() {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
      disposers.forEach((dispose) => dispose())
    },
  }
}

/** Patch every realistic material under `root` with caustics and absorption. */
export function submerge(root: Object3D, near = false) {
  root.traverse((object) => {
    if (!(object instanceof Mesh) || object.userData.noInk) return
    const list = Array.isArray(object.material)
      ? object.material
      : [object.material]
    for (const material of list)
      if (material instanceof MeshStandardMaterial) underwater(material, near)
  })
}
