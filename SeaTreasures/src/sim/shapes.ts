import type { Coil } from './coil.ts'

/**
 * Shell geometry for each species. These are drawing parameters, tuned so the
 * model reads like the real shell; they are not measurements.
 */
export type ShellShape =
  | {
      kind: 'coil'
      coil: Coil
      /** Wall thickness, as a fraction of the whorl radius. */
      wall: number
      chambers?: { perTurn: number; bodyChamber: number }
    }
  | {
      kind: 'cowrie'
      /** Width and height relative to the existing cowrie model. */
      width: number
      height: number
      /** How strongly the margins swell, as in a money cowrie. */
      margins: number
    }

export const shapes: Record<string, ShellShape> = {
  'tiger-cowrie': { kind: 'cowrie', width: 1, height: 1, margins: 0 },
  'money-cowrie': { kind: 'cowrie', width: 1.12, height: 0.82, margins: 1 },
  'textile-cone': {
    kind: 'coil',
    wall: 0.08,
    coil: {
      W: 5.5,
      D: 0.02,
      T: 1.5,
      aperture: [0.74, 1.9],
      tilt: 0.06,
      taper: 0.55,
      pinch: 0.85,
      turns: 6,
      handed: 1,
    },
  },
  'queen-conch': {
    kind: 'coil',
    wall: 0.1,
    coil: {
      W: 2.3,
      D: 0.05,
      T: 3.4,
      aperture: [0.72, 1.7],
      tilt: 0.25,
      taper: 0.5,
      pinch: 0.7,
      turns: 7,
      handed: 1,
      knobs: { perTurn: 8, height: 0.18, at: 0.9 },
      flare: { span: 3.4, amount: 1.4, at: -0.25 },
    },
  },
  'chambered-nautilus': {
    kind: 'coil',
    wall: 0.05,
    coil: {
      W: 3.1,
      D: 0,
      T: 0,
      aperture: [1, 0.72],
      tilt: 0,
      turns: 2.6,
      handed: 1,
    },
    chambers: { perTurn: 11, bodyChamber: Math.PI * 0.8 },
  },
}
