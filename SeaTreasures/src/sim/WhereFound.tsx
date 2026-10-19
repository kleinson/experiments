import { useId, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  ISOLATED_BELOW,
  OFTEN_FROM,
  placesFor,
  ranges,
  totalFor,
} from './ranges.ts'
import type { Ocean } from './ranges.ts'
import type { Species } from './species.ts'

const levelLabel = {
  none: 'No records',
  isolated: 'Isolated records',
  recorded: 'Recorded',
  often: 'Often recorded',
} as const

/**
 * Where a species has been recorded: a world map with a pin for every named
 * sea and island, sized by GBIF records, and the same places as a list.
 */
export function WhereFound({
  species,
  originId,
  onOrigin,
  fact,
}: {
  species: Species
  originId: string
  onOrigin: (id: string) => void
  /** Renders a sourced fact; passed in so this view shares the page's evidence UI. */
  fact: (claim: string, children: ReactNode) => ReactNode
}) {
  const id = useId()
  const [hover, setHover] = useState<string | null>(null)
  const places = placesFor(species.id)
  const total = totalFor(species.id)
  const native = ranges.records[species.id]?.native ?? null
  const { width, viewBox, land } = ranges.map
  const most = Math.max(1, ...places.map((place) => place.count.n))
  const focus =
    places.find((place) => place.region.id === (hover ?? originId)) ?? null
  const recorded = places.filter((place) => place.count.n > 0)
  const byOcean = Object.entries(ranges.oceans)
    .map(([ocean, label]) => ({
      ocean: ocean as Ocean,
      label,
      places: places
        .filter((place) => place.region.ocean === ocean)
        .sort((a, b) => b.count.n - a.count.n),
    }))
    .filter((group) => group.places.length)

  return (
    <section className="where" aria-labelledby={`${id}-title`}>
      <header className="where-head">
        <div>
          <p className="panel-label">Where it's found</p>
          <h2 id={`${id}-title`}>
            {recorded.length} of {places.length} seas and islands
          </h2>
        </div>
        {total &&
          fact(
            `${species.id}-gbif-records`,
            <>
              {total.n.toLocaleString('en-US')} located GBIF records: museum
              specimens and observations. Records show where people have looked,
              not how common it is.
            </>,
          )}
      </header>
      <div className="where-map">
        <svg
          viewBox={viewBox.join(' ')}
          role="img"
          aria-label={`World map of ${species.commonName} records. ${recorded
            .slice(0, 6)
            .map((place) => `${place.region.name}: ${place.count.n}`)
            .join(', ')}.`}
          onPointerLeave={() => setHover(null)}
        >
          <rect
            className="where-sea"
            x={viewBox[0]}
            y={viewBox[1]}
            width={width}
            height={viewBox[3]}
          />
          <path className="where-land" d={land} />
          {[...places]
            .sort(
              (a, b) =>
                Number(a.region.id === originId) -
                  Number(b.region.id === originId) || b.count.n - a.count.n,
            )
            .map((place) => {
              const radius =
                place.count.n === 0
                  ? 2.2
                  : 3.2 + 8 * Math.sqrt(place.count.n / most)
              const selected = place.region.id === originId
              return (
                <g
                  key={place.region.id}
                  className="where-pin"
                  data-level={place.level}
                  data-outside={place.outside || undefined}
                  data-selected={selected || undefined}
                  transform={`translate(${place.region.at[0]} ${place.region.at[1]})`}
                  onPointerEnter={() => setHover(place.region.id)}
                  onClick={() => place.count.n > 0 && onOrigin(place.region.id)}
                  style={{ '--r': radius } as CSSProperties}
                >
                  <circle r={radius + 6} className="where-hit" />
                  <circle r={radius} />
                  {selected && <circle r={radius + 4} className="where-ring" />}
                </g>
              )
            })}
        </svg>
        {focus && (
          <p className="where-readout" aria-live="polite">
            <strong>{focus.region.name}</strong> · {levelLabel[focus.level]}
            {focus.count.n > 0 &&
              ` · ${focus.count.n.toLocaleString('en-US')} record${focus.count.n === 1 ? '' : 's'} (${focus.count.observed} seen, ${focus.count.specimens} in collections)`}
            {focus.outside && ' · outside its documented range'}
          </p>
        )}
      </div>
      <div className="where-legend" aria-hidden="true">
        <span data-level="often">{OFTEN_FROM}+ records</span>
        <span data-level="recorded">
          {ISOLATED_BELOW}–{OFTEN_FROM - 1}
        </span>
        <span data-level="isolated">1–{ISOLATED_BELOW - 1}: isolated</span>
        <span data-level="none">none</span>
        {native && <span data-outside>outside documented range</span>}
      </div>
      <div className="where-lists">
        {byOcean.map((group) => (
          <div key={group.ocean} className="where-group">
            <h3>{group.label}</h3>
            <ul>
              {group.places.map((place) => (
                <li key={place.region.id}>
                  <button
                    data-level={place.level}
                    data-outside={place.outside || undefined}
                    aria-pressed={place.region.id === originId}
                    disabled={place.count.n === 0}
                    onClick={() => onOrigin(place.region.id)}
                    onPointerEnter={() => setHover(place.region.id)}
                    onFocus={() => setHover(place.region.id)}
                  >
                    <span>{place.region.name}</span>
                    <span className="where-count">
                      {place.count.n
                        ? place.count.n.toLocaleString('en-US')
                        : '–'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="where-notes">
        {native &&
          fact(
            native.claim,
            <>
              Its documented range covers{' '}
              {native.oceans.map((ocean) => ranges.oceans[ocean]).join(', ')}.
              Records elsewhere are flagged: they may be errors, imports, or
              shells moved by people or currents.
            </>,
          )}
        {species.drifts &&
          fact(
            'nautilus-drift',
            <>
              Empty nautilus shells float and can drift far, so some records may
              be shells, not living animals.
            </>,
          )}
        <p className="model-note">
          Fewer than {ISOLATED_BELOW} records in a place are shown as isolated.
          Region outlines are simple boxes. Counted from GBIF on{' '}
          {ranges.accessedAt}.
        </p>
      </div>
    </section>
  )
}
