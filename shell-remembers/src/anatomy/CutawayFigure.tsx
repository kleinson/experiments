import { useDeferredValue, useMemo, useState } from 'react'
import { getClaim } from '../evidence.ts'
import { Plate } from './Plate.tsx'
import {
  CUTAWAY,
  anatomyParts,
  cutawayProjection,
  cutawaySvg,
  partAnchors,
} from './animal.ts'
import type { AnatomyPart } from './animal.ts'
import { highlight } from './highlight.ts'
import { memo, useIdleTour } from './live.ts'
import { insideParts, partNotes, tourOrder } from './parts.ts'

const projection = cutawayProjection()
const render = memo(24, (key) => {
  const [open, mantle] = key.split('|')
  return cutawaySvg(Number(open), Number(mantle), projection)
})

const scopeLabel: Record<string, string> = {
  subspecies: 'this subspecies',
  species: 'this species',
  family: 'cowries as a family',
  mollusks: 'snails and molluscs generally',
  'other-cowries': 'other cowries',
}

export function CutawayFigure({
  mantle,
  reducedMotion,
}: {
  mantle: number
  reducedMotion: boolean
}) {
  const [open, setOpen] = useState(85)
  const [part, setPart] = useState<AnatomyPart>('mantle')
  const shownOpen = useDeferredValue(open)
  const quantized = Math.round(shownOpen / 5) * 5
  const quantizedMantle = Math.round(mantle / 5) * 5
  const tour = useIdleTour(
    () =>
      setPart((current) => {
        const visible = tourOrder.filter(
          (item) => open >= 40 || !insideParts.has(item),
        )
        return visible[(visible.indexOf(current) + 1) % visible.length]!
      }),
    2800,
    reducedMotion,
  )
  const body = render(`${quantized / 100}|${quantizedMantle}`)
  const anchors = useMemo(
    () => partAnchors(quantized / 100, projection),
    [quantized],
  )
  const note = partNotes[part]
  const claim = getClaim(note.claim)
  const choose = (next: AnatomyPart) => {
    tour.touch()
    setPart(next)
    if (insideParts.has(next) && open < 40) setOpen(85)
  }
  const step = (by: number) => {
    const list = tourOrder
    choose(list[(list.indexOf(part) + by + list.length) % list.length]!)
  }
  return (
    <Plate
      id="plate-cutaway"
      hostRef={tour.host}
      fig="Fig. 2"
      title="The animal inside"
      hint={tour.running ? 'Touring · tap a part' : 'Tap a part · ← →'}
      readout={note.label}
      label="A living Hawaiian tiger cowrie on a display stand, its shell cut open at the near upper side to show the animal inside."
      description={`Original cutaway illustration. Outside the shell: the foot, head with tentacles and eyes, the siphon and the mantle lobes, which cover ${mantle} percent of the shell, as set in the builder controls. Through the cut: the porcelain wall in section, the enclosed earlier whorls, the gill and osphradium in the mantle cavity, and the heart, kidney, stomach, digestive gland, gonad, gut and radula in the body. ${note.label} is highlighted. Positions and sizes of organs are simplified.`}
      width={CUTAWAY.width}
      height={CUTAWAY.height}
      body={body}
      onPointerEnter={tour.hold}
      onPointerLeave={tour.release}
      onFocus={tour.hold}
      onBlur={tour.release}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault()
          step(event.key === 'ArrowRight' ? 1 : -1)
        }
      }}
      overlay={[
        <style key="lit">{highlight('plate-cutaway', part)}</style>,
        ...anchors.map((anchor) => (
          <circle
            key={anchor.part}
            className="an-hit"
            cx={anchor.at[0]}
            cy={anchor.at[1]}
            r={16}
            aria-hidden="true"
            onClick={() => choose(anchor.part)}
          />
        )),
      ]}
      controls={
        <>
          <div className="an-control">
            <div className="control-header">
              <label htmlFor="cutaway-open">See inside</label>
              <output htmlFor="cutaway-open">
                {open < 5 ? 'Closed' : `${open}%`}
              </output>
            </div>
            <input
              className="range"
              id="cutaway-open"
              type="range"
              min="0"
              max="100"
              step="5"
              value={open}
              onChange={(event) => {
                tour.touch()
                setOpen(Number(event.target.value))
              }}
              aria-valuetext={
                open < 5
                  ? 'Shell closed'
                  : `Section plane ${open} percent of the way in`
              }
            />
          </div>
          <div className="an-chips" role="group" aria-label="Highlight a part">
            {anatomyParts.map((item) => (
              <button
                key={item}
                aria-pressed={part === item}
                onClick={() => choose(item)}
              >
                {partNotes[item].label}
              </button>
            ))}
          </div>
          <div className="an-note" aria-live="polite">
            <strong>{note.label}.</strong> {note.note}
            {claim && (
              <span className="an-scope">
                Evidence: {scopeLabel[claim.scope] ?? claim.scope} ·{' '}
                {claim.confidence} confidence
              </span>
            )}
          </div>
        </>
      }
      keys={[
        { mark: 'lit', label: 'Highlighted part' },
        { mark: 'raised', label: 'Porcelain shell' },
        { mark: 'flat', label: 'Living tissue (toned)' },
        { mark: 'edge', label: 'Ruler in mm' },
      ]}
      caption="An original cutaway, not a dissection. Organs are drawn simplified, and their placement inside the body is illustrative."
    />
  )
}
