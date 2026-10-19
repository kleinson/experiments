/**
 * Shell patterns as images in growth coordinates: u (x) is when that part of
 * the shell was made, from the first shell to the adult lip; v (y) runs around
 * the growing edge. A pattern is therefore a record of what the mantle edge
 * laid down over time.
 *
 * Every generator is a pure function of a seed, so the same species always
 * shows the same shell.
 */
export type Rgb = [number, number, number]

export type PatternSpec =
  | { kind: 'tents'; ground: Rgb; line: Rgb; light: Rgb; rate: number }
  | { kind: 'flames'; ground: Rgb; flame: Rgb; fadeFrom: number }
  | { kind: 'spots'; ground: Rgb; spot: Rgb; base: Rgb; count: number }
  | { kind: 'plain'; ground: Rgb; margin: Rgb; ring?: Rgb }
  | { kind: 'blotches'; ground: Rgb; blotch: Rgb }

export type Pixels = {
  width: number
  height: number
  data: Uint8ClampedArray<ArrayBuffer>
}

export function seeded(seed: number) {
  let value = seed % 2147483647 || 1
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

function canvas(
  width: number,
  height: number,
  fill: (x: number, y: number) => Rgb,
): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y)
      const at = (y * width + x) * 4
      data[at] = r
      data[at + 1] = g
      data[at + 2] = b
      data[at + 3] = 255
    }
  }
  return { width, height, data }
}

/**
 * Travelling waves along the growing edge. A wave starts at a point and
 * spreads both ways, leaving an unpigmented zone behind it, so each zone draws
 * a widening triangle. Zones stop spreading where they meet a neighbour and
 * close independently, giving each tent its own base.
 */
function tents(
  spec: Extract<PatternSpec, { kind: 'tents' }>,
  width: number,
  height: number,
  seed: number,
) {
  const random = seeded(seed)
  const light = new Uint8Array(width * height)
  const dark = new Uint8Array(width * height)
  const lit = new Uint8Array(height)
  let fronts: { at: number; dir: 1 | -1 }[] = []
  for (let x = 0; x < width; x++) {
    for (let start = 0; start < 3; start++) {
      if (random() >= spec.rate) continue
      const at = 1 + Math.floor(random() * (height - 2))
      if (lit[at]) continue
      lit[at] = 1
      fronts.push({ at, dir: 1 }, { at, dir: -1 })
    }
    const moved: typeof fronts = []
    for (const front of fronts) {
      const next = front.at + front.dir
      if (next < 0 || next >= height || lit[next]) continue
      lit[next] = 1
      moved.push({ at: next, dir: front.dir })
    }
    fronts = moved
    let y = 0
    while (y < height) {
      if (!lit[y]) {
        y++
        continue
      }
      let end = y
      while (end + 1 < height && lit[end + 1]) end++
      if (random() < 0.008 + (end - y) * 0.0016) {
        for (let k = y; k <= end; k++) {
          lit[k] = 0
          dark[k * width + x] = 1
        }
        fronts = fronts.filter((front) => front.at < y || front.at > end)
      }
      y = end + 1
    }
    for (let k = 0; k < height; k++) {
      light[k * width + x] = lit[k]!
      if (lit[k] && (!lit[k - 1] || !lit[k + 1])) dark[k * width + x] = 1
    }
  }
  return canvas(width, height, (x, y) => {
    const index = y * width + x
    if (dark[index]) return spec.line
    if (light[index])
      return mix(spec.light, spec.ground, ((x * 7 + y * 13) % 11) / 60)
    const net = (x + y) % 9 === 0 || (x - y + 900) % 11 === 0
    return net ? mix(spec.ground, spec.line, 0.6) : spec.ground
  })
}

function flames(
  spec: Extract<PatternSpec, { kind: 'flames' }>,
  width: number,
  height: number,
  seed: number,
) {
  const random = seeded(seed)
  const bands: { at: number; width: number; wobble: number; reach: number }[] =
    []
  for (let at = 0.02; at < 1; at += 0.022 + random() * 0.03) {
    bands.push({
      at,
      width: 0.006 + random() * 0.01,
      wobble: random() * 6,
      reach: 0.35 + random() * 0.3,
    })
  }
  return canvas(width, height, (x, y) => {
    const u = x / width
    const v = y / height
    const around = Math.min(v, 1 - v) * 2
    let ink = 0
    for (const band of bands) {
      const shift = Math.sin(v * 9 + band.wobble) * 0.012 + around * 0.04
      const distance = Math.abs(u - band.at - shift)
      if (distance < band.width && around < band.reach)
        ink = Math.max(ink, 1 - distance / band.width)
    }
    const fade =
      u < spec.fadeFrom
        ? 1
        : Math.max(0, 1 - (u - spec.fadeFrom) / (1 - spec.fadeFrom))
    return mix(spec.ground, spec.flame, Math.min(1, ink * 1.6) * fade)
  })
}

function spots(
  spec: Extract<PatternSpec, { kind: 'spots' }>,
  width: number,
  height: number,
  seed: number,
) {
  const random = seeded(seed)
  const list = Array.from({ length: spec.count }, () => ({
    u: random(),
    v: 0.12 + random() * 0.76,
    r: 0.006 + random() * 0.018,
    s: 0.6 + random() * 0.9,
    dark: 0.55 + random() * 0.45,
  }))
  const grid = new Map<number, typeof list>()
  for (const spot of list) {
    const key = Math.floor(spot.u * 24)
    for (const k of [key - 1, key, key + 1])
      grid.set(k, [...(grid.get(k) ?? []), spot])
  }
  return canvas(width, height, (x, y) => {
    const u = x / width
    const v = y / height
    const base = Math.abs(v - 0.5) > 0.42 ? 1 : 0
    let colour = mix(spec.ground, spec.base, base)
    for (const spot of grid.get(Math.floor(u * 24)) ?? []) {
      const dx = (u - spot.u) / spot.r
      const dy = ((v - spot.v) * 0.5) / (spot.r * spot.s)
      const d = dx * dx + dy * dy
      if (d < 1)
        colour = mix(colour, spec.spot, spot.dark * Math.min(1, (1 - d) * 4))
    }
    const dorsal = Math.abs(v - 0.5) < 0.004 ? 0.35 : 0
    return mix(colour, spec.ground, dorsal)
  })
}

function plain(
  spec: Extract<PatternSpec, { kind: 'plain' }>,
  width: number,
  height: number,
) {
  return canvas(width, height, (x, y) => {
    const v = y / height
    const margin = Math.max(0, Math.abs(v - 0.5) * 2 - 0.62) / 0.38
    let colour = mix(spec.ground, spec.margin, Math.min(1, margin * 1.3))
    if (spec.ring) {
      const ring = Math.abs(Math.hypot((x / width - 0.5) * 1.4, v - 0.5) - 0.17)
      if (ring < 0.012) colour = mix(colour, spec.ring, 0.55)
    }
    return colour
  })
}

function blotches(
  spec: Extract<PatternSpec, { kind: 'blotches' }>,
  width: number,
  height: number,
  seed: number,
) {
  const random = seeded(seed)
  const list = Array.from({ length: 160 }, () => ({
    u: random(),
    v: random(),
    r: 0.01 + random() * 0.03,
  }))
  return canvas(width, height, (x, y) => {
    const u = x / width
    const v = y / height
    let ink = 0
    for (const blot of list) {
      const d = Math.hypot((u - blot.u) / blot.r, (v - blot.v) / (blot.r * 3))
      if (d < 1) ink = Math.max(ink, (1 - d) * 0.7)
    }
    const lines = Math.pow(Math.abs(Math.sin(u * 480)), 30) * 0.18
    return mix(spec.ground, spec.blotch, Math.min(1, ink + lines))
  })
}

/** Faint growth lines: each one a former edge of the shell. */
function growthLines(pixels: Pixels, every: number, strength: number) {
  const { width, height, data } = pixels
  for (let x = 0; x < width; x++) {
    const phase = (x / width) * every
    const line =
      Math.pow(Math.max(0, Math.cos(phase * Math.PI * 2)), 40) * strength
    if (line < 0.01) continue
    for (let y = 0; y < height; y++) {
      const at = (y * width + x) * 4
      for (let c = 0; c < 3; c++) data[at + c] = data[at + c]! * (1 - line)
    }
  }
  return pixels
}

export function patternPixels(
  spec: PatternSpec,
  seed: number,
  width = 512,
  height = 192,
): Pixels {
  switch (spec.kind) {
    case 'tents':
      return growthLines(tents(spec, width, height, seed), 70, 0.1)
    case 'flames':
      return growthLines(flames(spec, width, height, seed), 90, 0.12)
    case 'spots':
      return spots(spec, width, height, seed)
    case 'plain':
      return plain(spec, width, height)
    case 'blotches':
      return growthLines(blotches(spec, width, height, seed), 110, 0.14)
  }
}

/** Ages a pattern: pigment fades and dulls toward a chalky grey as a shell weathers. */
export function weather(pixels: Pixels, amount: number): Pixels {
  if (amount <= 0) return pixels
  const data = new Uint8ClampedArray(pixels.data)
  for (let at = 0; at < data.length; at += 4) {
    const grey = (data[at]! + data[at + 1]! + data[at + 2]!) / 3
    const chalk = 225
    for (let c = 0; c < 3; c++) {
      const faded = data[at + c]! + (grey - data[at + c]!) * amount
      data[at + c] = faded + (chalk - faded) * amount * 0.55
    }
  }
  return { ...pixels, data }
}
