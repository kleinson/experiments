import type { KeyboardEvent, ReactNode, RefObject } from 'react'

export type LegendKey = {
  mark: 'raised' | 'flat' | 'lit' | 'edge' | 'dim' | 'dotted'
  label: string
}

function Swatch({ mark }: { mark: LegendKey['mark'] }) {
  if (mark === 'raised' || mark === 'flat' || mark === 'lit') {
    return (
      <svg
        className="iso-swatch"
        data-mark={mark}
        viewBox="0 0 16 10"
        aria-hidden="true"
      >
        <path
          d={
            mark === 'flat'
              ? 'M2 6.5 8 3.5 14 6.5 8 9.5Z'
              : 'M2 4.5 8 1.5 14 4.5 14 6 8 9 2 6Z'
          }
        />
        {mark !== 'flat' && (
          <path className="iso-swatch-crease" d="M2 4.5 8 7.5 14 4.5" />
        )}
      </svg>
    )
  }
  return (
    <svg
      className="iso-swatch"
      data-mark={mark}
      viewBox="0 0 16 10"
      aria-hidden="true"
    >
      <path d="M1.5 5h13" />
    </svg>
  )
}

/** The Anatomy card: figure number, title, hint and a live readout in its corners. */
export function Plate({
  id,
  fig,
  title,
  hint,
  readout,
  keys = [],
  caption,
  label,
  width,
  height,
  body,
  overlay,
  onKeyDown,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  description,
  controls,
  hostRef,
}: {
  id: string
  fig: string
  title: string
  hint: string
  readout: string
  keys?: LegendKey[]
  caption?: ReactNode
  label: string
  width: number
  height: number
  body: string
  overlay?: ReactNode
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  onFocus?: () => void
  onBlur?: () => void
  description: string
  controls?: ReactNode
  hostRef?: RefObject<HTMLDivElement | null>
}) {
  return (
    <figure
      className="iso-figure an-figure"
      id={id}
      aria-labelledby={`${id}-title`}
    >
      <div
        className="iso-plate"
        ref={hostRef}
        tabIndex={0}
        role="group"
        aria-label={`${fig}. ${title}. ${hint}`}
        aria-describedby={`${id}-description`}
        onKeyDown={onKeyDown}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <div className="iso-plate-corners">
          <span
            className="iso-plate-corner"
            data-corner="fig"
            aria-hidden="true"
          >
            {fig}
          </span>
          <span
            className="iso-plate-corner"
            data-corner="title"
            id={`${id}-title`}
          >
            {title}
          </span>
          <span
            className="iso-plate-corner"
            data-corner="hint"
            aria-hidden="true"
          >
            {hint}
          </span>
          <span
            className="iso-plate-corner"
            data-corner="readout"
            role="status"
          >
            {readout}
          </span>
        </div>
        <svg
          className="iso-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={label}
        >
          <g dangerouslySetInnerHTML={{ __html: body }} />
          {overlay}
        </svg>
        <p className="sr-only" id={`${id}-description`}>
          {description}
        </p>
      </div>
      {controls && <div className="an-controls">{controls}</div>}
      {(keys.length > 0 || caption) && (
        <figcaption className="iso-legend">
          {keys.length > 0 && (
            <span className="iso-keys">
              {keys.map((key) => (
                <span className="iso-key" key={key.label}>
                  <Swatch mark={key.mark} />
                  {key.label}
                </span>
              ))}
            </span>
          )}
          {caption && <span className="iso-caption">{caption}</span>}
        </figcaption>
      )}
    </figure>
  )
}
