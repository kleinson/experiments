import { getShape } from './model.ts'

export function shellPoint(
  u: number,
  theta: number,
  progress: number,
  inset = 0,
) {
  const shape = getShape(progress)
  const profile = Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.66)
  const cosine = Math.cos(theta)
  const radius = Math.max(0, profile - inset)
  return {
    x:
      Math.cos(Math.PI * u) * 1.78 * shape.scale +
      Math.sin(theta) * profile * profile * 0.08 * shape.scale,
    y:
      radius *
        shape.height *
        1.32 *
        cosine *
        (cosine < 0 ? 0.66 : 1) *
        shape.scale +
      0.06 * profile,
    z: radius * shape.width * 1.3 * Math.sin(theta) * shape.scale,
  }
}

export function makeSpots(count = 420) {
  let seed = 4173
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  return Array.from({ length: count }, () => ({
    u: 0.07 + random() * 0.86,
    v: 0.13 + random() * 0.74,
    size: 0.002 + random() * 0.009,
    stretch: 0.65 + random() * 1.3,
    angle: random() * Math.PI,
    opacity: 0.45 + random() * 0.5,
  }))
}
