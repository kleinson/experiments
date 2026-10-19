import experience from '../data/experience.json' with { type: 'json' }

export { experience }

export type Moment = 'discover' | 'identify' | 'builder' | 'growth' | 'meaning'
export const moments: { id: Moment; label: string }[] = [
  { id: 'discover', label: 'Discover' },
  { id: 'identify', label: 'Meet' },
  { id: 'builder', label: 'The builder' },
  { id: 'growth', label: 'Growth & time' },
  { id: 'meaning', label: 'What remains' },
]

export type GrowthStage = (typeof experience.stages)[number]
export type ShellState = {
  progress: number
  lengthMm: number
  mantle: number
  showRepair: boolean
}

export const initialShellState: ShellState = {
  progress: 100,
  lengthMm: experience.specimen.defaultLengthMm,
  mantle: 0,
  showRepair: false,
}

export function bounded(value: number, min: number, max: number): number {
  if (!Number.isFinite(value))
    throw new RangeError('A finite number is required.')
  return Math.max(min, Math.min(max, value))
}

export function getStage(progress: number): GrowthStage {
  const position = bounded(progress, 0, 100)
  return (
    experience.stages.findLast((stage) => position >= stage.startsAt) ??
    experience.stages[0]
  )
}

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

export function getShellSummary(state: ShellState): string {
  const stage = getStage(state.progress)
  return [
    `${experience.specimen.commonName}, ${stage.label.toLowerCase()} conceptual illustration.`,
    `Demo adult reference length ${state.lengthMm} millimeters; this is independent of the growth-stage slider.`,
    state.mantle > 0
      ? `Mantle tissue highlighted at ${state.mantle} percent coverage.`
      : 'Empty shell view.',
    state.showRepair ? 'A hypothetical repair mark is highlighted.' : '',
    state.progress < 75
      ? 'A highlighted rim marks the conceptual shell-building edge.'
      : '',
    'Chronological age is unknown.',
  ]
    .filter(Boolean)
    .join(' ')
}

export function describeSize(lengthMm: number): {
  category: 'reference' | 'large' | 'near-maximum' | 'beyond-reference'
  title: string
  detail: string
} {
  const length = bounded(
    lengthMm,
    experience.measurement.minMm,
    experience.measurement.maxMm,
  )
  const guide = experience.sizeGuide
  if (length > guide.reportedMaximumMm) {
    return {
      category: 'beyond-reference',
      title: 'Beyond this reference’s reported maximum.',
      detail: `${length} mm is above the cited ${guide.reportedMaximumMm} mm maximum. Recheck length and identification; this is not a record claim.`,
    }
  }
  if (length >= guide.nearMaximumFromMm) {
    return {
      category: 'near-maximum',
      title: 'Close to the reported upper end.',
      detail: `${length} mm is ${guide.reportedMaximumMm - length} mm below this reference’s ${guide.reportedMaximumMm} mm maximum. That does not establish rarity or age.`,
    }
  }
  if (length > guide.largeAboveMm) {
    return {
      category: 'large',
      title: 'Large against this field reference.',
      detail: `${length} mm exceeds its roughly ${guide.largeAboveMm} mm large-specimen marker. This is a comparison with one guide, not a measured population percentile.`,
    }
  }
  const difference = length - guide.reportedAverageMm
  return {
    category: 'reference',
    title:
      difference === 0
        ? 'At the cited average.'
        : 'An adult reference, in perspective.',
    detail:
      difference === 0
        ? `${length} mm matches this guide’s approximate adult average. An individual shell is not a population statistic.`
        : `${length} mm is ${Math.abs(difference)} mm ${difference > 0 ? 'longer' : 'shorter'} than its approximate ${guide.reportedAverageMm} mm adult average. That alone does not establish maturity or age.`,
  }
}

export type SavedSpecimen = {
  version: 1
  specimenId: string
  lengthMm: number
  note: string
  savedAt: string
}

export const collectionKey = 'seatreasures.collection.v1'

export function parseSavedSpecimen(raw: string): SavedSpecimen {
  const value: unknown = JSON.parse(raw)
  if (
    typeof value !== 'object' ||
    value === null ||
    !('version' in value) ||
    value.version !== 1 ||
    !('specimenId' in value) ||
    value.specimenId !== experience.specimen.id ||
    !('lengthMm' in value) ||
    typeof value.lengthMm !== 'number' ||
    !Number.isInteger(value.lengthMm) ||
    value.lengthMm < experience.measurement.minMm ||
    value.lengthMm > experience.measurement.maxMm ||
    !('note' in value) ||
    typeof value.note !== 'string' ||
    value.note.length > 280 ||
    !('savedAt' in value) ||
    typeof value.savedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.savedAt))
  ) {
    throw new Error('The saved specimen has an unsupported or damaged format.')
  }
  return {
    version: 1,
    specimenId: value.specimenId,
    lengthMm: value.lengthMm,
    note: value.note,
    savedAt: value.savedAt,
  }
}

export function createSavedSpecimen(
  lengthMm: number,
  note: string,
  now = new Date(),
): SavedSpecimen {
  if (
    !Number.isInteger(lengthMm) ||
    lengthMm < experience.measurement.minMm ||
    lengthMm > experience.measurement.maxMm
  ) {
    throw new RangeError(
      'The specimen length is outside the demo measurement range.',
    )
  }
  if (note.length > 280)
    throw new RangeError('Notes may contain up to 280 characters.')
  return {
    version: 1,
    specimenId: experience.specimen.id,
    lengthMm,
    note,
    savedAt: now.toISOString(),
  }
}
