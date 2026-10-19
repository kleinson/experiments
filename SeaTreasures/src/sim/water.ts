import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import type { WebGLProgramParametersWithUniforms } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { seeded } from './patterns.ts'
import type { Rgb } from './patterns.ts'
import type { Setting } from './seabed.ts'

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
}

const NOISE = /* glsl */ `
float stHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
// Voronoi-style caustic web: bright where cells meet, which is how focused light looks on sand.
float stCaustic(vec2 p, float t) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float first = 8.0;
  float second = 8.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(stHash(i + g), stHash(i + g + 17.0));
      o = 0.5 + 0.42 * sin(t + 6.2831 * o);
      float d = length(g + o - f);
      if (d < first) { second = first; first = d; }
      else if (d < second) second = d;
    }
  return 1.0 - smoothstep(0.0, 0.12, second - first);
}
`

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
    shader.uniforms.stScale = water.scale
    shader.uniforms.stWater = water.colour
    shader.uniforms.stNear = water.near
    shader.uniforms.stFar = water.far
    shader.uniforms.stCentre = water.centre
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
        varying vec3 stWorld;
        varying vec3 stNormalW;
        ${NOISE}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `
        {
          vec2 q = stWorld.xz / stScale;
          float t = stTime * 0.6;
          // Two layers at different scales and speeds, slightly split by colour like real caustics.
          float c1 = stCaustic(q + vec2(t * 0.11, t * 0.07), t);
          float c2 = stCaustic(q * 1.7 - vec2(t * 0.05, t * 0.09) + 3.1, t * 1.3);
          float c = c1 * 0.65 + c2 * 0.45;
          float up = smoothstep(-0.1, 0.8, stNormalW.y);
          outgoingLight += diffuseColor.rgb * vec3(0.55, 0.62, 0.65) * c * up * stCaustics * ${strength};
          // Absorption: red fades first, then everything sinks into the water colour.
          float d = length(stWorld - stCentre);
          float fade = smoothstep(stNear, stFar, d) * ${fades};
          outgoingLight *= mix(vec3(1.0), vec3(0.78, 0.92, 0.98), smoothstep(stNear * 0.5, stFar, d) * ${fades});
          outgoingLight = mix(outgoingLight, stWater, fade);
          // The far seabed dissolves into the water behind the canvas: no hard horizon.
          ${material.userData.horizon ? 'diffuseColor.a *= 1.0 - smoothstep(stFar * 0.8, stFar * 1.15, length(stWorld.xz - stCentre.xz));' : ''}
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
export function waterFor(setting: Setting, extent: number, dark: boolean): Rgb {
  const deep = (setting.mix.deep ?? 0) > 0.3
  const colour: Rgb =
    setting.scene === 'beach'
      ? [170, 205, 215]
      : deep
        ? [16, 48, 78]
        : setting.scene === 'open-water'
          ? [60, 140, 170]
          : setting.main === 'kelp'
            ? [62, 112, 104]
            : setting.main === 'seagrass'
              ? [70, 150, 150]
              : [64, 150, 176]
  const shade = dark ? 0.6 : 0.85
  water.colour.value.setRGB(
    ((colour[0] / 255) * shade) ** 2.2,
    ((colour[1] / 255) * shade) ** 2.2,
    ((colour[2] / 255) * shade) ** 2.2,
  )
  water.scale.value = extent * 0.55
  water.caustics.value =
    setting.scene === 'beach'
      ? 0
      : deep
        ? 0.15
        : setting.main === 'kelp'
          ? 0.45
          : 0.75
  water.near.value = extent * (deep ? 1.5 : 2.5)
  water.far.value = extent * (deep ? 8 : 11.5)
  return colour.map((c) => Math.round(c * shade)) as Rgb
}

/**
 * The water around the seabed: the surface seen from below, shafts of light
 * and a few small fish. Returns its own animate and dispose.
 */
export function buildWater(setting: Setting, extent: number, seed: number) {
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
    // The bright surface overhead is the page's own gradient behind the canvas; an orthographic
    // camera would draw a surface plane across the whole view.
    const surfaceY = deep ? E * 14 : E * 7

    // God rays: tall soft cones from the surface, additive and slowly breathing.
    const rays: Mesh[] = []
    const rayCount = 0
    for (let i = 0; i < rayCount; i++) {
      const height = surfaceY * 1.1
      const geometry = own(
        new ConeGeometry(E * (0.6 + random() * 1.2), height, 24, 1, true),
      )
      geometry.translate(0, -height / 2, 0)
      const material = mat(
        new ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          side: DoubleSide,
          uniforms: {
            strength: { value: (deep ? 0.05 : 0.09) * (0.6 + random() * 0.6) },
          },
          vertexShader: /* glsl */ `
            varying float vY;
            varying vec3 vN;
            varying vec3 vView;
            void main() {
              vY = uv.y;
              vec4 world = modelMatrix * vec4(position, 1.0);
              vN = normalize(mat3(modelMatrix) * normal);
              vView = normalize(cameraPosition - world.xyz);
              gl_Position = projectionMatrix * viewMatrix * world;
            }`,
          fragmentShader: /* glsl */ `
            uniform float strength;
            varying float vY;
            varying vec3 vN;
            varying vec3 vView;
            void main() {
              float edge = pow(abs(dot(vN, vView)), 1.6);
              float a = strength * edge * smoothstep(0.0, 0.45, vY) * smoothstep(1.0, 0.85, vY);
              gl_FragColor = vec4(vec3(0.9, 1.0, 1.0) * a, a);
            }`,
        }),
      )
      const ray = new Mesh(geometry, material)
      const angle = random() * Math.PI * 2
      const r = E * (2 + random() * 6)
      ray.position.set(
        Math.cos(angle) * r,
        surfaceY,
        Math.sin(angle) * r - E * 2,
      )
      ray.rotation.set(0.18 + random() * 0.1, 0, -0.25 - random() * 0.1)
      ray.userData.noInk = true
      ray.renderOrder = 2
      rays.push(ray)
      group.add(ray)
    }
    updates.push((t) => {
      rays.forEach((ray, i) => {
        ray.scale.x = ray.scale.z = 1 + Math.sin(t * 0.3 + i * 1.7) * 0.12
      })
    })

    // A small school of reef fish circling at a distance (not identified to species).
    const fishCount = deep ? 0 : setting.scene === 'open-water' ? 18 : 12
    if (fishCount) {
      const body = new SphereGeometry(1, 12, 8)
      body.scale(1, 0.38, 0.2)
      const tail = new ConeGeometry(0.32, 0.55, 4)
      tail.rotateZ(Math.PI / 2)
      tail.translate(-1.1, 0, 0)
      const geometry = own(mergeGeometries([body, tail])!)
      body.dispose()
      tail.dispose()
      const fishColour = new Color(0.9, 0.62, 0.24)
      const material = mat(
        underwater(
          new MeshStandardMaterial({ color: fishColour, roughness: 0.5 }),
        ),
      )
      const school = new InstancedMesh(geometry, material, fishCount)
      school.userData.noInk = true
      const fish = Array.from({ length: fishCount }, (_, i) => ({
        radius: E * (3.5 + random() * 1.5),
        height: E * (1.6 + random() * 1.2),
        speed: 0.12 + random() * 0.05,
        phase: (i / fishCount) * 0.9 + random() * 0.15,
        size: E * (0.09 + random() * 0.05),
        wobble: random() * 6,
      }))
      const matrix = new Matrix4()
      const q = new Quaternion()
      const up = new Vector3(0, 1, 0)
      const at = new Vector3()
      const scale = new Vector3()
      const centre = new Vector3(-E * 2, 0, -E * 3)
      updates.push((t) => {
        fish.forEach((f, i) => {
          const a = t * f.speed + f.phase * Math.PI * 2
          at.set(
            centre.x + Math.cos(a) * f.radius,
            f.height + Math.sin(t * 0.8 + f.wobble) * E * 0.08,
            centre.z + Math.sin(a) * f.radius * 0.6,
          )
          q.setFromAxisAngle(up, -a - Math.PI / 2)
          scale.setScalar(f.size)
          matrix.compose(at, q, scale)
          school.setMatrixAt(i, matrix)
        })
        school.instanceMatrix.needsUpdate = true
        school.computeBoundingSphere()
      })
      group.add(school)
    }
  }

  // Fine suspended particles catching the light, everywhere but the beach.
  if (setting.scene !== 'beach') {
    const count = 700
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (random() - 0.5) * E * 16
      positions[i * 3 + 1] = random() * E * 6
      positions[i * 3 + 2] = (random() - 0.5) * E * 16
    }
    const geometry = own(new BufferGeometry())
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    const dust = new Mesh(
      own(new SphereGeometry(E * 0.008, 4, 3)),
      mat(
        new MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.35,
        }),
      ),
    )
    const motes = new InstancedMesh(
      dust.geometry,
      dust.material as Material,
      count,
    )
    const m = new Matrix4()
    const base = Array.from(
      { length: count },
      (_, i) =>
        new Vector3(
          positions[i * 3],
          positions[i * 3 + 1],
          positions[i * 3 + 2],
        ),
    )
    const p = new Vector3()
    updates.push((t) => {
      base.forEach((b, i) => {
        p.set(
          b.x + Math.sin(t * 0.2 + i) * E * 0.1,
          b.y + Math.sin(t * 0.15 + i * 0.7) * E * 0.06,
          b.z + Math.cos(t * 0.18 + i) * E * 0.1,
        )
        m.makeTranslation(p.x, p.y, p.z)
        motes.setMatrixAt(i, m)
      })
      motes.instanceMatrix.needsUpdate = true
    })
    motes.userData.noInk = true
    motes.frustumCulled = false
    group.add(motes)
  }

  const animate = (t: number) => updates.forEach((update) => update(t))
  animate(0)
  return {
    group,
    animate,
    dispose() {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
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
