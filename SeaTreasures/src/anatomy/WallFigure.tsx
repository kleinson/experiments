import { useDeferredValue, useRef, useState } from 'react'
import { Plate } from './Plate.tsx'
import { memo, useIdleTour } from './live.ts'
import { WALL, wallProjection, wallSvg } from './wall.ts'

const projection = wallProjection()
const render = memo(24, (key) => wallSvg(Number(key), projection))

export function WallFigure({ reducedMotion }: { reducedMotion: boolean }) {
  const [growth, setGrowth] = useState(100)
  const rest = useRef(0)
  const tour = useIdleTour(
    () => {
      if (growth < 100) return setGrowth(Math.min(100, growth + 10))
      rest.current += 1
      if (rest.current < 4) return
      rest.current = 0
      setGrowth(0)
    },
    700,
    reducedMotion,
  )
  const shown = useDeferredValue(growth)
  const body = render(String((Math.round(shown / 5) * 5) / 100))
  const stage =
    growth >= 98 ? 'complete' : growth < 3 ? 'not yet laid' : `${growth}% laid`
  return (
    <Plate
      id="plate-wall"
      hostRef={tour.host}
      fig="Fig. 3"
      title="How the shell is built"
      hint={tour.running ? 'Building · drag to hold' : 'Drag the control below'}
      readout={`Newest coat ${stage}`}
      label="A stepped block cut from the shell wall, with the mantle's secreting cells above the newest layer."
      description={`Original illustration of a stepped cutaway through a shell wall. From the bottom: three mineral layers built of thin plates turned in different directions, then the newest glossy coat, which is ${stage}. A dotted film marks the organic matrix it grows on. Above it, the mantle: a sheet of secreting cells, highlighted, under the tissue that carries the papillae. Layer thicknesses and plate directions are illustrative.`}
      width={WALL.width}
      height={WALL.height}
      body={body}
      onPointerEnter={tour.hold}
      onPointerLeave={tour.release}
      onFocus={tour.hold}
      onBlur={tour.release}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault()
          tour.touch()
          setGrowth((value) =>
            Math.max(
              0,
              Math.min(100, value + (event.key === 'ArrowRight' ? 10 : -10)),
            ),
          )
        }
      }}
      controls={
        <>
          <div className="an-control">
            <div className="control-header">
              <label htmlFor="wall-growth">Lay down the newest coat</label>
              <output htmlFor="wall-growth">{stage}</output>
            </div>
            <input
              className="range"
              id="wall-growth"
              type="range"
              min="0"
              max="100"
              step="5"
              value={growth}
              onChange={(event) => {
                tour.touch()
                setGrowth(Number(event.target.value))
              }}
              aria-valuetext={`Newest coat ${stage}`}
            />
          </div>
          <dl className="an-facts">
            <div>
              <dt>What it is made of</dt>
              <dd>
                Mostly aragonite, a form of calcium carbonate, with a small
                organic fraction of about 1–5% by weight.
                <span className="an-scope">
                  Evidence: aragonitic sea-snail shells generally · moderate
                  confidence
                </span>
              </dd>
            </div>
            <div>
              <dt>What the organic part does</dt>
              <dd>
                Proteins and polysaccharides guide how the mineral crystals grow
                and line up.
                <span className="an-scope">
                  Evidence: sea-snail shells generally · moderate confidence
                </span>
              </dd>
            </div>
            <div>
              <dt>Who builds it</dt>
              <dd>
                The mantle. Snails enlarge the shell at its growing edge. A
                cowrie’s mantle also spreads over the outside and lays down its
                glossy coat.
                <span className="an-scope">
                  Evidence: snails generally (high); cowries as a family
                  (moderate)
                </span>
              </dd>
            </div>
          </dl>
        </>
      }
      keys={[
        { mark: 'lit', label: 'Mantle cells (the builder)' },
        { mark: 'raised', label: 'Mineral layers' },
        { mark: 'dotted', label: 'Organic film' },
      ]}
      caption="Not to scale. Layers and plate directions are a generic illustration of layered shell mineral, not a measured cowrie microstructure."
    />
  )
}
