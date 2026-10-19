import {
  Color,
  CustomBlending,
  DataTexture,
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshNormalMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  NoBlending,
  Object3D,
  OneFactor,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  Scene,
  ShaderMaterial,
  ShadowMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
  ZeroFactor,
} from 'three'
import type { Camera } from 'three'

/**
 * Two ways to show the same specimen. The drawing is an educational plate:
 * soft tonal washes, crisp patterns, a fine ink outline with lighter interior
 * lines and a soft cast shadow. The realistic view keeps the physical
 * materials. A style value between 0 (drawing) and 1 (realistic) blends them.
 */
export type Look = 'drawn' | 'real'

/** A smooth light ramp, like a wash laid in a few layers rather than a hard toon step. */
const RAMP = [0.3, 0.36, 0.46, 0.6, 0.75, 0.88, 0.96, 1]
function washRamp() {
  const ramp = new DataTexture(
    new Uint8Array(RAMP.map((value) => Math.round(value * 255))),
    RAMP.length,
    1,
    RedFormat,
    UnsignedByteType,
  )
  ramp.minFilter = LinearFilter
  ramp.magFilter = LinearFilter
  ramp.generateMipmaps = false
  ramp.needsUpdate = true
  return ramp
}

/** Light for each look. The drawing's lit side shows the true colour. */
export const LIGHTS: Record<
  Look,
  { ambient: number; hemisphere: number; key: number; rim: number }
> = {
  drawn: { ambient: 1.25, hemisphere: 0, key: 1.9, rim: 0 },
  real: { ambient: 0.5, hemisphere: 1.6, key: 2.6, rim: 1.1 },
}

function drawn(source: Material, ramp: DataTexture): Material {
  if (
    source instanceof ShadowMaterial ||
    source instanceof MeshBasicMaterial ||
    source instanceof MeshToonMaterial ||
    source.userData.keep
  )
    return source
  const from = source as MeshStandardMaterial
  const material = new MeshToonMaterial({
    color: from.color?.clone() ?? new Color(1, 1, 1),
    map: from.map ?? null,
    gradientMap: ramp,
    side: from.side,
    transparent: from.transparent,
    opacity: from.opacity,
    depthWrite: from.depthWrite,
    clippingPlanes: from.clippingPlanes,
    clipShadows: true,
  })
  if (from instanceof MeshPhysicalMaterial && from.transmission > 0) {
    // Jelly-like egg capsules are drawn see-through.
    material.transparent = true
    material.opacity = Math.min(material.opacity, 0.72)
    material.depthWrite = false
  }
  material.name = from.name
  return material
}

type Looks = Record<Look, Material | Material[]>

/**
 * Gives every surface under `root` a drawn twin of its realistic material and
 * lets it cast shadows. `wear` switches between them. Returns a disposer for
 * the drawn materials it made.
 */
export function inkify(root: Object3D) {
  const made = new Map<Material, Material>()
  const ramp = washRamp()
  const twin = (material: Material) => {
    let next = made.get(material)
    if (!next) {
      next = drawn(material, ramp)
      made.set(material, next)
    }
    return next
  }
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const real = object.material as Material | Material[]
    const looks: Looks = {
      real,
      drawn: Array.isArray(real) ? real.map(twin) : twin(real),
    }
    object.userData.looks = looks
    if (!object.userData.ground) object.castShadow = true
  })
  return () => {
    for (const [from, to] of made) if (from !== to) to.dispose()
    made.clear()
    ramp.dispose()
  }
}

/** Dresses every inked surface under `root` in one look. */
export function wear(root: Object3D, look: Look) {
  root.traverse((object) => {
    const looks = object.userData.looks as Looks | undefined
    if (looks && object instanceof Mesh) object.material = looks[look]
  })
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAGMENT = /* glsl */ `
uniform sampler2D tDrawn;
uniform sampler2D tReal;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float thickness;
uniform float depthScale;
uniform float depthEdge;
uniform float style;
uniform float lines;
uniform vec3 ink;
varying vec2 vUv;

vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
// The realistic view keeps the filmic response it was lit for.
vec3 filmic(vec3 colour) {
  const mat3 inMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777)
  );
  const mat3 outMat = mat3(
    vec3(1.60475, -0.10208, -0.00327),
    vec3(-0.53108, 1.10813, -0.07276),
    vec3(-0.07367, -0.00605, 1.07602)
  );
  colour = inMat * (colour / 0.6);
  colour = RRTAndODTFit(colour);
  return clamp(outMat * colour, 0.0, 1.0);
}

vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(
    c * 12.92,
    1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,
    step(vec3(0.0031308), c)
  );
}

// Outline (silhouettes and overlaps) and crease (folds within a surface) at one point.
vec2 edgeAt(vec2 uv) {
  vec4 n0 = texture2D(tNormal, uv);
  float d0 = texture2D(tDepth, uv).x;
  float outline = 0.0;
  float crease = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    vec2 dir = vec2(cos(a), sin(a));
    vec2 o = dir * thickness * texel;
    vec4 n1 = texture2D(tNormal, uv + o);
    float d1 = texture2D(tDepth, uv + o).x;
    outline = max(outline, smoothstep(0.15, 0.65, abs(n1.a - n0.a)));
    if (n0.a > 0.5 && n1.a > 0.5) {
      outline = max(outline, smoothstep(depthEdge, depthEdge * 2.5, abs(d1 - d0) * depthScale));
      vec4 n2 = texture2D(tNormal, uv + o * 0.6);
      vec3 a0 = n0.rgb * 2.0 - 1.0;
      vec3 a2 = n2.rgb * 2.0 - 1.0;
      crease = max(crease, smoothstep(0.22, 0.55, 1.0 - dot(a0, a2)));
    }
  }
  return vec2(outline, crease);
}

void main() {
  // Four offset samples smooth the ink into a fine, even line.
  vec2 e = vec2(0.0);
  e += edgeAt(vUv + vec2(-0.25, -0.25) * texel);
  e += edgeAt(vUv + vec2(0.25, -0.25) * texel);
  e += edgeAt(vUv + vec2(-0.25, 0.25) * texel);
  e += edgeAt(vUv + vec2(0.25, 0.25) * texel);
  e *= 0.25;
  float line = max(e.x, e.y * 0.45) * lines;

  vec4 drawn = texture2D(tDrawn, vUv);
  vec4 real = texture2D(tReal, vUv);
  vec3 drawnColour = drawn.rgb / max(drawn.a, 1e-4);
  vec3 realColour = filmic(real.rgb / max(real.a, 1e-4));
  float alpha = mix(drawn.a, real.a, style);
  vec3 colour = mix(drawnColour * drawn.a, realColour * real.a, style);
  colour = colour / max(alpha, 1e-4);

  vec3 shown = mix(toSrgb(colour), ink, line);
  float coverage = alpha + (1.0 - alpha) * line;
  gl_FragColor = vec4(shown * coverage, coverage);
}
`

export type InkOptions = {
  /** 0 is the drawing, 1 is realistic. */
  style: number
  /** Ink colour of the outlines, in sRGB. */
  ink: Color
  /** World units for a depth step that counts as an edge. */
  depthEdge: number
  /** Called before each look is drawn, to set its lights and shadow. */
  light?: (look: Look) => void
}

/** Renders the drawn and realistic looks, outlines the drawing and blends them. */
export class InkPass {
  private drawn = new WebGLRenderTarget(1, 1, {
    samples: 4,
    type: HalfFloatType,
  })
  private real = new WebGLRenderTarget(1, 1, {
    samples: 4,
    type: HalfFloatType,
  })
  private normals = new WebGLRenderTarget(1, 1, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthTexture: new DepthTexture(1, 1),
  })
  private twins = new Map<Material, Material>()
  private hidden = new MeshBasicMaterial({ visible: false })
  private quad: Mesh<PlaneGeometry, ShaderMaterial>
  private screen = new Scene()
  private flat = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

  constructor() {
    this.quad = new Mesh(
      new PlaneGeometry(2, 2),
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        blending: NoBlending,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          tDrawn: { value: this.drawn.texture },
          tReal: { value: this.real.texture },
          tNormal: { value: this.normals.texture },
          tDepth: { value: this.normals.depthTexture },
          texel: { value: new Vector2(1, 1) },
          thickness: { value: 1 },
          depthScale: { value: 1 },
          depthEdge: { value: 1 },
          style: { value: 0 },
          lines: { value: 1 },
          ink: { value: new Color() },
        },
      }),
    )
    this.quad.frustumCulled = false
    this.screen.add(this.quad)
  }

  setSize(width: number, height: number, pixelRatio: number) {
    const w = Math.max(1, Math.round(width * pixelRatio))
    const h = Math.max(1, Math.round(height * pixelRatio))
    this.drawn.setSize(w, h)
    this.real.setSize(w, h)
    this.normals.setSize(w, h)
    this.quad.material.uniforms.texel!.value.set(1 / w, 1 / h)
    this.quad.material.uniforms.thickness!.value = 1.15 * pixelRatio
  }

  /** Normals for solid surfaces; see-through ones only mark coverage, so what is inside them still gets lines. */
  private twin(material: Material) {
    let twin = this.twins.get(material)
    if (twin) return twin
    if (material instanceof ShadowMaterial || !material.visible) {
      twin = this.hidden
    } else if (material.transparent && material.opacity < 0.95) {
      twin = new MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: material.side,
        clippingPlanes: material.clippingPlanes,
        blending: CustomBlending,
        blendSrc: ZeroFactor,
        blendDst: OneFactor,
        blendSrcAlpha: OneFactor,
        blendDstAlpha: ZeroFactor,
      })
    } else {
      twin = new MeshNormalMaterial({
        side: material.side,
        clippingPlanes: material.clippingPlanes,
      })
    }
    this.twins.set(material, twin)
    return twin
  }

  /** Forget cached twins (after the scene's materials were replaced). */
  forget() {
    for (const twin of this.twins.values())
      if (twin !== this.hidden) twin.dispose()
    this.twins.clear()
  }

  private pass(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    target: WebGLRenderTarget,
  ) {
    renderer.setRenderTarget(target)
    renderer.clear()
    renderer.render(scene, camera)
  }

  render(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera & { near: number; far: number },
    options: InkOptions,
  ) {
    const style = Math.min(1, Math.max(0, options.style))
    const lines = 1 - smooth(0.05, 0.85, style)
    const clear = renderer.getClearColor(new Color())
    const alpha = renderer.getClearAlpha()
    renderer.setClearColor(0x000000, 0)

    if (style < 1) {
      wear(scene, 'drawn')
      options.light?.('drawn')
      this.pass(renderer, scene, camera, this.drawn)
    }
    if (style > 0) {
      wear(scene, 'real')
      options.light?.('real')
      this.pass(renderer, scene, camera, this.real)
    }
    if (lines > 0) {
      const swapped: [Mesh, Material | Material[]][] = []
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return
        swapped.push([object, object.material])
        object.material = Array.isArray(object.material)
          ? object.material.map((m) => this.twin(m))
          : this.twin(object.material)
      })
      const shadows = renderer.shadowMap.enabled
      renderer.shadowMap.enabled = false
      this.pass(renderer, scene, camera, this.normals)
      renderer.shadowMap.enabled = shadows
      for (const [mesh, material] of swapped) mesh.material = material
    }
    // Leave the scene in its realistic dress, so picking and bounds see the source materials.
    wear(scene, 'real')

    const uniforms = this.quad.material.uniforms
    uniforms.ink!.value.copy(options.ink)
    uniforms.depthScale!.value = camera.far - camera.near
    uniforms.depthEdge!.value = options.depthEdge
    uniforms.style!.value = style
    uniforms.lines!.value = lines
    renderer.setRenderTarget(null)
    renderer.render(this.screen, this.flat)
    renderer.setClearColor(clear, alpha)
  }

  dispose() {
    this.forget()
    this.hidden.dispose()
    this.drawn.dispose()
    this.real.dispose()
    this.normals.depthTexture?.dispose()
    this.normals.dispose()
    this.quad.geometry.dispose()
    this.quad.material.dispose()
  }
}

const smooth = (from: number, to: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)))
  return t * t * (3 - 2 * t)
}
