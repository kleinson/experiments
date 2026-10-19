import { CutawayFigure } from '../anatomy/CutawayFigure.tsx'
import { WallFigure } from '../anatomy/WallFigure.tsx'
import '../anatomy/anatomy.css'

/** The tiger cowrie's anatomy plates, kept as a deeper look under the simulator. */
export default function FieldPlates({
  reducedMotion,
}: {
  reducedMotion: boolean
}) {
  return (
    <section className="an-plates" data-count="2" aria-label="Field plates">
      <CutawayFigure mantle={55} reducedMotion={reducedMotion} />
      <WallFigure reducedMotion={reducedMotion} />
    </section>
  )
}
