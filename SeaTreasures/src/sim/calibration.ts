/**
 * True size on screen. Browsers assume 96 CSS pixels per inch, but real
 * screens differ, so the reader can match an on-screen card to a real bank
 * card (ISO/IEC 7810 ID-1: 85.60 × 53.98 mm) and we remember the result.
 */
export const CARD_MM: [number, number] = [85.6, 53.98]
export const DEFAULT_PX_PER_MM = 96 / 25.4
export const PX_PER_MM_RANGE: [number, number] = [2, 9]
export const calibrationKey = 'seatreasures.calibration.v1'

export function parseCalibration(raw: string | null): number | null {
  if (raw === null) return null
  const value = Number(JSON.parse(raw)?.pxPerMm)
  if (
    !Number.isFinite(value) ||
    value < PX_PER_MM_RANGE[0] ||
    value > PX_PER_MM_RANGE[1]
  )
    throw new Error('The saved screen calibration is invalid.')
  return value
}

export function readCalibration(storage: Pick<Storage, 'getItem'>) {
  try {
    return {
      pxPerMm:
        parseCalibration(storage.getItem(calibrationKey)) ?? DEFAULT_PX_PER_MM,
      calibrated: storage.getItem(calibrationKey) !== null,
      error: null,
    }
  } catch (error) {
    console.error('Screen calibration could not be read.', error)
    return {
      pxPerMm: DEFAULT_PX_PER_MM,
      calibrated: false,
      error:
        'Your saved screen calibration could not be read, so the standard estimate is used.',
    }
  }
}

export function saveCalibration(
  storage: Pick<Storage, 'setItem'>,
  pxPerMm: number,
) {
  if (
    !Number.isFinite(pxPerMm) ||
    pxPerMm < PX_PER_MM_RANGE[0] ||
    pxPerMm > PX_PER_MM_RANGE[1]
  )
    throw new RangeError('Calibration is out of range.')
  storage.setItem(
    calibrationKey,
    JSON.stringify({ pxPerMm, savedAt: new Date().toISOString() }),
  )
}

/** A scale bar length that reads well: 1, 2, 5, 10, 20, 50 or 100 mm. */
export function scaleBar(pxPerMm: number, targetPx = 96) {
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200]
  let best = steps[0]!
  for (const mm of steps) if (mm * pxPerMm <= targetPx * 1.4) best = mm
  return { mm: best, px: best * pxPerMm }
}
