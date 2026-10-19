import type { DeathMark, Duration, Species } from './species.ts'

/**
 * A whole life on one timeline. The scrubber is not a linear clock: real
 * durations range from days to decades, so each phase gets a readable share of
 * the track and the clock beside it reports the sourced time, or says it is
 * unknown.
 */
export const phases = [
  { id: 'egg', label: 'Egg', share: 0.09 },
  { id: 'larva', label: 'Larva', share: 0.09 },
  { id: 'growth', label: 'Growing', share: 0.24 },
  { id: 'adult', label: 'Adult', share: 0.14 },
  { id: 'death', label: 'Death', share: 0.1 },
  { id: 'remains', label: 'Empty shell', share: 0.12 },
  { id: 'beach', label: 'Beach', share: 0.12 },
  { id: 'found', label: 'Found', share: 0.1 },
] as const

export type PhaseId = (typeof phases)[number]['id']

export const phaseStarts = phases.reduce<number[]>((starts, _phase, index) => {
  starts.push(index ? starts[index - 1]! + phases[index - 1]!.share : 0)
  return starts
}, [])

export function phaseAt(t: number) {
  const clamped = Math.min(1, Math.max(0, t))
  let index = phases.length - 1
  for (let i = 0; i < phases.length; i++) {
    if (clamped < phaseStarts[i]! + phases[i]!.share) {
      index = i
      break
    }
  }
  const start = phaseStarts[index]!
  const local = Math.min(1, (clamped - start) / phases[index]!.share)
  return { index, phase: phases[index]!, local }
}

/** The timeline position where a phase begins. */
export const startOf = (id: PhaseId) =>
  phaseStarts[phases.findIndex((phase) => phase.id === id)]!

export type LifeFrame = {
  phase: PhaseId
  local: number
  /** Shell size as a fraction of the adult; 0 before any shell exists. */
  size: number
  /** How far an adult lip has flared or thickened, 0–1. */
  lip: number
  /** Living animal present (fades out as it dies). */
  animal: number
  egg: number
  larva: number
  mark: DeathMark
  hermit: number
  drift: number
  /** On the beach: wear, from fresh to chalky. */
  wear: number
  beach: boolean
}

/** The protoconch: the larval shell, a small fraction of the adult. */
export const firstShell = 0.012

export function frameAt(
  t: number,
  species: Species,
  mark: DeathMark,
): LifeFrame {
  const { phase, local } = phaseAt(t)
  const base: LifeFrame = {
    phase: phase.id,
    local,
    size: 1,
    lip: 1,
    animal: 0,
    egg: 0,
    larva: 0,
    mark: 'none',
    hermit: 0,
    drift: 0,
    wear: 0,
    beach: false,
  }
  switch (phase.id) {
    case 'egg':
      return { ...base, size: 0, lip: 0, egg: 1 }
    case 'larva':
      // A nautilus hatches as a small, already-chambered juvenile, not a larva.
      return {
        ...base,
        size: species.group === 'cephalopod' ? 0.16 : firstShell,
        lip: 0,
        larva: 1,
        animal: 1,
      }
    case 'growth': {
      const eased = 1 - Math.pow(1 - local, 1.6)
      const start = species.group === 'cephalopod' ? 0.16 : firstShell
      return { ...base, size: start + (1 - start) * eased, lip: 0, animal: 1 }
    }
    case 'adult':
      return { ...base, lip: Math.min(1, local * 1.6), animal: 1 }
    case 'death':
      return { ...base, animal: 1 - local, mark: local > 0.35 ? mark : 'none' }
    case 'remains':
      return {
        ...base,
        mark,
        hermit: species.hermit ? Math.max(0, (local - 0.35) / 0.4) : 0,
        drift: species.drifts ? local : 0,
      }
    case 'beach':
      return { ...base, mark, beach: true, wear: local * 0.65 }
    case 'found':
      return { ...base, mark, beach: true, wear: 0.65 }
  }
}

const unitLabel = (value: number, unit: 'days' | 'years') => {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10
  if (unit === 'days') return `${rounded} ${rounded === 1 ? 'day' : 'days'}`
  return `${rounded} ${rounded === 1 ? 'year' : 'years'}`
}

export function describeDuration(duration: Duration): string {
  if (!duration.range) return 'Not established'
  const [low, high] = duration.range
  if (low === high) return `About ${unitLabel(low, duration.unit)}`
  return `${low}–${unitLabel(high, duration.unit)}`
}

/** What the timeline's clock says at this point, using only sourced durations. */
export function clockAt(
  frame: LifeFrame,
  species: Species,
): { label: string; known: boolean } {
  const { egg, larva, maturity, lifespan } = species.life
  switch (frame.phase) {
    case 'egg':
      return egg.range
        ? {
            label: `Egg · ${describeDuration(egg).toLowerCase()} in all`,
            known: true,
          }
        : { label: 'Egg · time not established', known: false }
    case 'larva':
      return larva.range
        ? {
            label: `Larva · ${describeDuration(larva).toLowerCase()}`,
            known: true,
          }
        : {
            label:
              larva.text.length < 60
                ? larva.text
                : 'Larval time not established',
            known: false,
          }
    case 'growth':
      return maturity.range
        ? {
            label: `Building the shell · adult size in ${describeDuration(maturity).toLowerCase()}`,
            known: true,
          }
        : {
            label: 'Building the shell · time to adult not established',
            known: false,
          }
    case 'adult':
      return lifespan.range
        ? {
            label: `Adult · lives ${describeDuration(lifespan).toLowerCase()}`,
            known: true,
          }
        : { label: 'Adult · lifespan not established', known: false }
    case 'death':
      return { label: 'The animal dies', known: true }
    case 'remains':
      return { label: 'Empty shell · time varies', known: false }
    case 'beach':
      return { label: 'On the shore · time varies', known: false }
    case 'found':
      return { label: 'In your hand', known: true }
  }
}
