/**
 * A coiled shell as a tube swept along a logarithmic helicospiral, after
 * Raup's coiling model: whorl expansion (W), distance of the generating curve
 * from the axis (D) and translation along the axis (T). The apex sits on the
 * z axis at the origin, z is up, and units are coil units until scaled.
 *
 * Growth is accretionary: the animal adds shell only at the aperture, so a
 * younger shell is the same coil cut off earlier.
 */
export type Coil = {
  /** Whorl expansion per revolution. */
  W: number
  /** Relative distance of the generating curve from the axis, 0–1. */
  D: number
  /** Axial translation per unit of whorl radius; 0 is planispiral. */
  T: number
  /** Aperture half-axes: radial and axial, relative to the whorl scale. */
  aperture: [number, number]
  /** Rotation of the aperture ellipse in its plane, radians. */
  tilt: number
  /** Revolutions from the protoconch to the adult aperture. */
  turns: number
  /** 1 for right-handed (dextral) coiling. */
  handed: 1 | -1
  /**
   * Narrows the aperture outline toward its lower end (a siphonal canal) and
   * widens it at the shoulder: 0 is a plain ellipse.
   */
  taper?: number
  /** Pulls the lower end of the outline in toward the axis: a cone's point or a siphonal canal. */
  pinch?: number
  /** Knobs on the shoulder: count per revolution, height, and where on the whorl. */
  knobs?: { perTurn: number; height: number; at: number }
  /** An adult lip that flares out over the last part of the last whorl. */
  flare?: { span: number; amount: number; at: number }
}

export type Point3 = [number, number, number]

const TAU = Math.PI * 2
const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export const growthRate = (coil: Coil) => Math.log(coil.W) / TAU
export const adultAngle = (coil: Coil) => coil.turns * TAU

/**
 * A point on the outer (inset 0) or inner (inset > 0) surface, in coil units.
 * `theta` runs from 0 at the protoconch; `s` goes around the aperture.
 * `flare` is how far the adult lip has grown, 0–1.
 */
export function coilPoint(
  coil: Coil,
  theta: number,
  s: number,
  { inset = 0, flare = 0 }: { inset?: number; flare?: number } = {},
): Point3 {
  const scale = Math.exp(growthRate(coil) * theta)
  const centre = (scale * (1 + coil.D)) / (1 - coil.D)
  let radius = scale * (1 - inset)
  if (coil.knobs) {
    const wave = Math.pow(Math.max(0, Math.sin(coil.knobs.perTurn * theta)), 6)
    const band = Math.exp(-Math.pow((s - coil.knobs.at) / 0.35, 2))
    radius *=
      1 + coil.knobs.height * wave * band * smooth(TAU, TAU * 2.5, theta)
  }
  if (coil.flare && flare > 0) {
    const last = adultAngle(coil)
    const along = smooth(last - coil.flare.span, last, theta)
    const side = Math.pow(Math.max(0, Math.cos(s - coil.flare.at)), 2)
    radius *= 1 + coil.flare.amount * flare * along * side
  }
  const taper = coil.taper ? Math.max(0.12, 1 + coil.taper * Math.sin(s)) : 1
  const ca = Math.cos(s) * coil.aperture[0] * taper
  const cb = Math.sin(s) * coil.aperture[1]
  const radial = ca * Math.cos(coil.tilt) - cb * Math.sin(coil.tilt)
  const axial = ca * Math.sin(coil.tilt) + cb * Math.cos(coil.tilt)
  const pinch = coil.pinch
    ? 1 - coil.pinch * Math.pow(Math.max(0, -Math.sin(s)), 1.3)
    : 1
  const reach = centre * pinch + radius * radial
  const angle = coil.handed * theta
  return [
    reach * Math.cos(angle),
    reach * Math.sin(angle),
    -coil.T * centre + radius * axial,
  ]
}

/** Bounds of the adult outer surface in coil units. */
export function coilBounds(coil: Coil, flare = 1) {
  const min: Point3 = [Infinity, Infinity, Infinity]
  const max: Point3 = [-Infinity, -Infinity, -Infinity]
  const last = adultAngle(coil)
  const span = Math.min(last, TAU * 2.5)
  for (let i = 0; i <= 300; i++) {
    const theta = last - (i / 300) * span
    for (let j = 0; j < 32; j++) {
      const p = coilPoint(coil, theta, (j / 32) * TAU, { flare })
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis]!, p[axis]!)
        max[axis] = Math.max(max[axis]!, p[axis]!)
      }
    }
  }
  return { min, max }
}

/** Millimetres per coil unit, so the adult shell's longest dimension is `lengthMm`. */
export function coilScale(coil: Coil, lengthMm: number) {
  const { min, max } = coilBounds(coil)
  return lengthMm / Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2])
}

/**
 * The built coil angle once the shell has reached `fraction` of its adult
 * size. Size grows exponentially with angle along a logarithmic spiral, so the
 * angle grows with the logarithm of size.
 */
export function builtAngle(coil: Coil, fraction: number) {
  const k = growthRate(coil)
  const last = adultAngle(coil)
  const first = Math.min(last, Math.PI * 1.2)
  const f = Math.max(Math.exp((first - last) * k), Math.min(1, fraction))
  return last + Math.log(f) / k
}

/** Angles of the chamber walls (septa) behind the living chamber. */
export function septumAngles(
  end: number,
  perTurn: number,
  bodyChamber: number,
) {
  const angles: number[] = []
  for (
    let theta = Math.PI * 0.7;
    theta < end - bodyChamber;
    theta += TAU / perTurn
  )
    angles.push(theta)
  return angles
}
