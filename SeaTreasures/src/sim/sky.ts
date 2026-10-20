/**
 * The light overhead, seen from under water: the sun, the bright round
 * window where the surface lets the sky through (Snell's window, about 97°
 * across), its rippling edge and the shafts of light fanning down from the
 * sun. It is one full-screen shader on its own small canvas behind the
 * scene, so it costs almost nothing and never touches the specimen.
 *
 * The camera is orthographic and has no field of view, so the shader lays a
 * wide imaginary lens over it: looking level, the top of the screen sees up
 * toward the surface; looking down, the light slides off the top.
 *
 * In open water it also draws big fish passing far off in the blue: a loose
 * school of jacks and a lone tuna, as hazy silhouettes. They are drawn through
 * the same lens at their real length and distance (60–70 cm jacks 6–9 m away,
 * a 1.3 m tuna 12 m away) and fade with the water's visibility, so they read as
 * distant even though the specimen beside them may be a millimetre long.
 */

export type SkyState = {
  /** The camera's view elevation, radians: 0 is level, −π/2 straight down. */
  pitch: number
  /** The camera's azimuth around the specimen, radians. */
  yaw: number
  /** Metres below the surface. */
  depthM: number
  /** Daylight reaching this depth, 0–1 (depth.ts / water.ts). */
  daylight: number
  night: boolean
  /** The water's colour, sRGB 0–255. */
  tone: [number, number, number]
  time: number
  /** Open water: big fish pass far off in the blue. */
  pelagic: boolean
}

const VERTEX = /* glsl */ `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`

const FRAGMENT = /* glsl */ `
precision mediump float;
uniform vec2 res;
uniform float pitch, yaw, depth, day, night, time, pelagic;
uniform vec3 tone;

const float FOV = 2.1;
const float WINDOW = 0.723;   // 41.4° above level: the edge of Snell's window
const float SUN_EL = 1.2;     // a mid-morning sun, refracted steeper under water
const float SUN_AZ = 0.55;

vec3 toDir(float el, float az) {
  return vec3(cos(el) * sin(az), sin(el), -cos(el) * cos(az));
}

// Cheap warped sines: the moving lattice of the surface seen from below.
float ripples(vec2 p, float t) {
  vec2 q = p;
  float v = 0.0;
  for (int i = 0; i < 3; i++) {
    q += vec2(sin(q.y * 1.7 + t * 0.7), cos(q.x * 1.3 - t * 0.55)) * 0.4;
    v += sin(q.x * 2.1) + sin(q.y * 2.4);
  }
  return 0.5 + 0.5 * sin(v * 1.1);
}

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

// A side-on fish silhouette one unit long, head towards +x: a tapering body and a forked tail.
// Returns its coverage, softened over one pixel (px, in body lengths).
float fishShape(vec2 p, float deep, float wag, float px) {
  float bx = (p.x - 0.04) / 0.44;
  float h = deep * sqrt(max(0.0, 1.0 - bx * bx));
  float body = clamp((h - abs(p.y)) / px + 0.5, 0.0, 1.0);
  float tx = -p.x - 0.36;
  float spread = (0.02 + tx * 1.25) * wag;
  float notch = (tx - 0.07) * 0.9;
  float tail = step(0.0, tx) * clamp((0.2 - tx) / px + 0.5, 0.0, 1.0)
    * clamp((spread - abs(p.y)) / px + 0.5, 0.0, 1.0)
    * clamp((abs(p.y) - notch) / px + 0.5, 0.0, 1.0);
  return max(body, tail);
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  float aspect = res.x / res.y;
  float el = pitch + (uv.y - 0.5) * FOV;
  float az = yaw + (uv.x - 0.5) * FOV * aspect;
  vec3 dir = toDir(el, az);
  vec3 sun = toDir(SUN_EL, SUN_AZ);

  // How sharply the surface still reads: crisp in the shallows, a glow by 40 m.
  float shallow = exp(-depth / 14.0);
  float clear = exp(-depth / 28.0);
  float t = time;

  // Snell's window: bright inside, its edge a thin bright rim; outside it the
  // surface mirrors the darker water below.
  float window = smoothstep(WINDOW - 0.06, WINDOW + 0.04, el);
  float up = max(dir.y, 0.06);
  vec2 plane = dir.xz / up * 2.2;
  float shimmer = ripples(plane + vec2(t * 0.05, 0.0), t);
  float rim = exp(-pow((el - WINDOW) / 0.035, 2.0));
  float mirror = smoothstep(-0.05, 0.35, el) * (1.0 - window);
  float surface =
    window * (0.32 + 0.45 * shimmer * shallow) +
    rim * 0.35 * shallow +
    mirror * (0.05 + 0.06 * shimmer) * shallow;
  surface *= clear;

  // The sun: a hard disc only near the surface, a soft halo that widens with depth.
  float c = max(dot(dir, sun), 0.0);
  float halo = pow(c, mix(5.0, 60.0, shallow)) * (0.25 + 0.5 * clear);
  float disc = smoothstep(0.9975, 0.9988, c) * shallow * 1.4;

  // God rays: shafts fanning down from where the sun sits on the screen.
  float d = SUN_AZ - yaw;
  d = mod(d + 3.14159, 6.28318) - 3.14159;
  vec2 sunUv = vec2(d / (FOV * aspect) + 0.5, (SUN_EL - pitch) / FOV + 0.5);
  vec2 p = (uv - sunUv) * vec2(aspect, 1.0);
  float r = length(p);
  float ang = atan(p.x, -p.y);
  float beams = 0.5 + 0.5 * sin(ang * 23.0 + sin(ang * 7.0 + t * 0.25) * 2.2 + t * 0.12);
  beams *= 0.5 + 0.5 * sin(ang * 41.0 - t * 0.18 + 1.3);
  beams = pow(beams, 2.2);
  float cone = smoothstep(1.35, 0.2, abs(ang));
  float rays = beams * cone * smoothstep(0.02, 0.4, r) * exp(-r * 0.55)
    * exp(-depth / 30.0) * 0.55;

  float light = (surface + halo + disc + rays) * day;
  light *= mix(1.0, 0.06, night);
  // Sunlight is white near the surface and takes on the water's colour below.
  vec3 tint = mix(tone * 1.6 + 0.25, vec3(1.0, 0.98, 0.92), shallow);
  vec3 colour = clamp(tint * light, 0.0, 1.0);
  float a = clamp(max(colour.r, max(colour.g, colour.b)), 0.0, 1.0);

  // Distant pelagic fish, seen against the light: dark backs, paler bellies, lost in the haze.
  float cover = 0.0;
  vec3 fishTint = vec3(0.0);
  if (pelagic > 0.5) {
    float px0 = FOV / res.y;
    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      bool lone = i == 7;
      float dist = lone ? 12.0 : 6.0 + hash(fi + 1.0) * 3.0;
      float len = lone ? 1.3 : 0.6 + hash(fi + 2.0) * 0.12;
      float heading = lone ? -1.0 : 1.0;
      // Cruising about 0.5–0.7 m/s, across the view in under a minute.
      float azC = lone
        ? 2.4 - time * 0.055
        : time * 0.075 + (hash(fi + 3.0) - 0.5) * 0.5;
      float elC = lone
        ? 0.3 + sin(time * 0.05) * 0.04
        : 0.12 + (hash(fi + 4.0) - 0.5) * 0.16 + sin(time * 0.3 + fi) * 0.01;
      float size = len / dist;
      float dAz = mod(az - azC + 3.14159, 6.28318) - 3.14159;
      vec2 q = vec2(dAz * heading, el - elC) / size;
      if (abs(q.x) > 0.7 || abs(q.y) > 0.4) continue;
      float wag = 0.85 + 0.15 * sin(time * (lone ? 3.0 : 4.5) + fi * 1.7);
      float m = fishShape(q, lone ? 0.13 : 0.17, wag, px0 / size);
      float haze = exp(-dist / 15.0);
      float hit = m * haze;
      if (hit > cover) {
        cover = hit;
        fishTint = mix(tone * 0.35, tone * 0.85 + 0.04, smoothstep(0.02, -0.1, q.y));
      }
    }
    cover *= clamp(day * 1.4, 0.0, 1.0) * (1.0 - night);
  }
  colour = fishTint * cover + colour * (1.0 - cover);
  a = cover + a * (1.0 - cover);
  gl_FragColor = vec4(colour, a);
}`

/** Below this canvas resolution the light is soft anyway, so it renders small. */
const SCALE = 0.5

export function createSky(host: HTMLElement) {
  const canvas = document.createElement('canvas')
  canvas.className = 'sim-sky'
  canvas.setAttribute('aria-hidden', 'true')
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  })
  if (!gl) return null
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      console.warn(gl.getShaderInfoLog(shader))
    return shader
  }
  const program = gl.createProgram()!
  const vertex = compile(gl.VERTEX_SHADER, VERTEX)
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT)
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(program))
    return null
  }
  gl.useProgram(program)
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  )
  const position = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  const u = (name: string) => gl.getUniformLocation(program, name)
  const at = {
    res: u('res'),
    pitch: u('pitch'),
    yaw: u('yaw'),
    depth: u('depth'),
    day: u('day'),
    night: u('night'),
    time: u('time'),
    tone: u('tone'),
    pelagic: u('pelagic'),
  }
  host.prepend(canvas)

  let width = 0
  let height = 0
  return {
    canvas,
    resize(cssWidth: number, cssHeight: number) {
      width = Math.max(1, Math.round(cssWidth * SCALE))
      height = Math.max(1, Math.round(cssHeight * SCALE))
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
    },
    render(state: SkyState | null) {
      canvas.hidden = !state
      if (!state || !width) return
      gl.uniform2f(at.res, width, height)
      gl.uniform1f(at.pitch, state.pitch)
      gl.uniform1f(at.yaw, state.yaw)
      gl.uniform1f(at.depth, state.depthM)
      gl.uniform1f(at.day, state.daylight)
      gl.uniform1f(at.night, state.night ? 1 : 0)
      gl.uniform1f(at.time, state.time)
      gl.uniform1f(at.pelagic, state.pelagic ? 1 : 0)
      gl.uniform3f(
        at.tone,
        state.tone[0] / 255,
        state.tone[1] / 255,
        state.tone[2] / 255,
      )
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose() {
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
    },
  }
}
