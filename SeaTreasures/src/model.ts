import experience from '../data/experience.json' with { type: 'json' }

export { experience }

export function bounded(value: number, min: number, max: number): number {
  if (!Number.isFinite(value))
    throw new RangeError('A finite number is required.')
  return Math.max(min, Math.min(max, value))
}

/** The cowrie's conceptual juvenile-to-adult form, shared by the 3D shell and the plates. */
export function getShape(progress: number) {
  const t = bounded(progress, 0, 100) / 100
  return {
    scale: 0.38 + 0.62 * t,
    width: 0.62 + 0.12 * t,
    height: 0.5 + 0.22 * t,
    opening: 0.72 - 0.64 * t,
    coilVisibility: Math.max(0, 1 - t * 2.4),
    teeth: bounded((t - 0.4) / 0.6, 0, 1),
  }
}
