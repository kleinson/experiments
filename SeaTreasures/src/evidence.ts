import raw from '../data/claims.json' with { type: 'json' }

export type Source = {
  id: string
  title: string
  publisher: string
  url: string
  accessedAt: string
  kind: string
  accessNote: string
}
export type Claim = {
  id: string
  text: string
  sourceIds: string[]
  scope: string
  confidence: string
  evidenceNote: string
}
export type Manifest = { version: 1; sources: Source[]; claims: Claim[] }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`The evidence manifest has an invalid ${field}.`)
  }
  return value
}

export function parseManifest(value: unknown): Manifest {
  if (
    !record(value) ||
    value.version !== 1 ||
    !Array.isArray(value.sources) ||
    !Array.isArray(value.claims) ||
    value.sources.length === 0 ||
    value.claims.length === 0
  ) {
    throw new Error('The evidence manifest format is unsupported.')
  }
  const sources = value.sources.map((item): Source => {
    if (!record(item)) throw new Error('A source entry is malformed.')
    const url = text(item.url, 'source URL')
    if (new URL(url).protocol !== 'https:') {
      throw new Error('Evidence sources must use HTTPS.')
    }
    const accessedAt = text(item.accessedAt, 'access date')
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(accessedAt) ||
      !Number.isFinite(Date.parse(accessedAt))
    ) {
      throw new Error('A source access date is invalid.')
    }
    return {
      id: text(item.id, 'source ID'),
      title: text(item.title, 'source title'),
      publisher: text(item.publisher, 'publisher'),
      url,
      accessedAt,
      kind: text(item.kind, 'source kind'),
      accessNote: typeof item.accessNote === 'string' ? item.accessNote : '',
    }
  })
  const sourceIds = new Set(sources.map((source) => source.id))
  if (sourceIds.size !== sources.length) {
    throw new Error('The evidence manifest contains duplicate source IDs.')
  }
  const claims = value.claims.map((item): Claim => {
    if (
      !record(item) ||
      !Array.isArray(item.sourceIds) ||
      !item.sourceIds.every((id): id is string => typeof id === 'string')
    ) {
      throw new Error('A claim entry is malformed.')
    }
    if (
      item.sourceIds.some((id) => !sourceIds.has(id)) ||
      (item.sourceIds.length === 0 && item.scope !== 'demo-limitation')
    ) {
      throw new Error('A scientific claim is missing its supporting source.')
    }
    if (
      !['high', 'moderate', 'limited'].includes(
        text(item.confidence, 'confidence'),
      )
    ) {
      throw new Error('A claim has an unsupported confidence level.')
    }
    return {
      id: text(item.id, 'claim ID'),
      text: text(item.text, 'claim text'),
      sourceIds: item.sourceIds,
      scope: text(item.scope, 'evidence scope'),
      confidence: text(item.confidence, 'confidence'),
      evidenceNote: text(item.evidenceNote, 'evidence note'),
    }
  })
  if (new Set(claims.map((claim) => claim.id)).size !== claims.length) {
    throw new Error('The evidence manifest contains duplicate claim IDs.')
  }
  return { version: 1, sources, claims }
}

export const manifest = parseManifest(raw)

export function getClaim(id: string): Claim {
  const claim = manifest.claims.find((entry) => entry.id === id)
  if (!claim)
    throw new Error(`The experience refers to a missing claim: ${id}.`)
  return claim
}

export function sourcesFor(claim: Claim): Source[] {
  return claim.sourceIds.map((id) => {
    const source = manifest.sources.find((entry) => entry.id === id)
    if (!source)
      throw new Error(`The experience refers to a missing source: ${id}.`)
    return source
  })
}
