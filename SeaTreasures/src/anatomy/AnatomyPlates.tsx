import type { Moment } from '../model.ts'
import { CutawayFigure } from './CutawayFigure.tsx'
import { DrawerFigure } from './DrawerFigure.tsx'
import { WallFigure } from './WallFigure.tsx'
import './anatomy.css'

export default function AnatomyPlates({
  moment,
  progress,
  lengthMm,
  mantle,
  reducedMotion,
  onProgress,
}: {
  moment: Moment
  progress: number
  lengthMm: number
  mantle: number
  reducedMotion: boolean
  onProgress: (value: number) => void
}) {
  if (moment === 'builder')
    return (
      <section
        className="an-plates"
        aria-labelledby="plates-builder"
        data-count="1"
      >
        <header className="an-plates-head">
          <h2 id="plates-builder">See through the shell</h2>
          <p>
            Cut the shell open to meet the animal that made it: the mantle that
            builds, the foot that carries, and the organs inside.
          </p>
        </header>
        <CutawayFigure mantle={mantle} reducedMotion={reducedMotion} />
      </section>
    )
  if (moment === 'growth')
    return (
      <section
        className="an-plates"
        aria-labelledby="plates-growth"
        data-count="2"
      >
        <header className="an-plates-head">
          <h2 id="plates-growth">Every shell it was, and what it is made of</h2>
          <p>
            The same model, laid out in a specimen drawer. Then a cut through
            the wall itself, where the mantle lays down new mineral.
          </p>
        </header>
        <DrawerFigure
          progress={progress}
          lengthMm={lengthMm}
          onProgress={onProgress}
        />
        <WallFigure reducedMotion={reducedMotion} />
      </section>
    )
  return null
}
