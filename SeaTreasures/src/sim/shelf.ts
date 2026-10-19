/**
 * Shells the reader has "picked up" at the end of a life, kept only on this
 * device. Records are strictly validated so a damaged store is reported and
 * never silently overwritten.
 */
export type Found = { speciesId: string; originId: string; foundAt: string }

export const shelfKey = 'seatreasures.shelf.v1'
export const SHELF_LIMIT = 40

export function parseShelf(
  raw: string | null,
  known: (speciesId: string, originId: string) => boolean,
): Found[] {
  if (raw === null) return []
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value) || value.length > SHELF_LIMIT)
    throw new Error('The shelf is unreadable.')
  return value.map((item) => {
    if (typeof item !== 'object' || item === null)
      throw new Error('A shelf entry is malformed.')
    const { speciesId, originId, foundAt } = item as Record<string, unknown>
    if (
      typeof speciesId !== 'string' ||
      typeof originId !== 'string' ||
      typeof foundAt !== 'string'
    )
      throw new Error('A shelf entry is malformed.')
    if (!known(speciesId, originId))
      throw new Error('A shelf entry names an unknown shell.')
    if (!Number.isFinite(Date.parse(foundAt)))
      throw new Error('A shelf entry has an invalid date.')
    return { speciesId, originId, foundAt }
  })
}

export function addToShelf(
  shelf: Found[],
  entry: Omit<Found, 'foundAt'>,
  now = new Date(),
): Found[] {
  const next = [{ ...entry, foundAt: now.toISOString() }, ...shelf]
  return next.slice(0, SHELF_LIMIT)
}
