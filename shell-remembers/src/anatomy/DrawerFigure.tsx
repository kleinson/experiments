import { useMemo } from 'react'
import { experience, getShape, getStage } from '../model.ts'
import { Plate } from './Plate.tsx'
import { highlight } from './highlight.ts'
import {
  DRAWER,
  drawerProjection,
  drawerSvg,
  drawerTargets,
  stageProgress,
} from './drawer.ts'

const projection = drawerProjection()
const targets = drawerTargets(projection)

export function DrawerFigure({
  progress,
  lengthMm,
  onProgress,
}: {
  progress: number
  lengthMm: number
  onProgress: (value: number) => void
}) {
  const stage = getStage(progress)
  const selected = experience.stages.findIndex((item) => item.id === stage.id)
  const body = useMemo(() => drawerSvg(lengthMm, projection), [lengthMm])
  const shape = getShape(stageProgress[selected]!)
  const choose = (index: number) =>
    onProgress(stageProgress[Math.max(0, Math.min(3, index))]!)
  return (
    <Plate
      id="plate-drawer"
      fig="Fig. 1"
      title="Every shell it was"
      hint="Tap a compartment · ← →"
      readout={`${stage.label} · opening ${Math.round((shape.opening / 0.72) * 100)}% · teeth ${Math.round(shape.teeth * 100)}%`}
      label="A museum specimen drawer holding the same cowrie at four conceptual growth stages, each shown top-side up behind and aperture-side up in front."
      description={`Four compartments, from juvenile on the left to mature adult on the right. The back row shows each shell from above; the front row shows its underside, where the opening narrows and teeth form along the lips. ${stage.label} is highlighted. Sizes follow the conceptual model at a ${lengthMm} millimetre adult reference; the ruler on the drawer front is in millimetres.`}
      width={DRAWER.width}
      height={DRAWER.height}
      body={body}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault()
          choose(selected + (event.key === 'ArrowRight' ? 1 : -1))
        }
      }}
      overlay={[
        <style key="lit">
          {highlight('plate-drawer', `stage-${selected}`)}
        </style>,
        ...targets.map((target) => (
          <path
            key={target.stage}
            className="an-hit"
            d={target.d}
            aria-hidden="true"
            onClick={() => choose(target.stage)}
          />
        )),
      ]}
      keys={[
        { mark: 'lit', label: 'Selected stage' },
        { mark: 'raised', label: 'Top, then underside' },
        { mark: 'edge', label: 'Ruler in mm' },
      ]}
      caption="One conceptual model drives the 3D shell and every specimen here. Relative sizes and shapes are illustrative, not measured growth."
    />
  )
}
