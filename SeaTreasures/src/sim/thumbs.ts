import {
  AmbientLight,
  Color,
  DirectionalLight,
  NoToneMapping,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { InkPass, inkify, LIGHTS } from './ink.ts'
import { frameAt, startOf } from './life.ts'
import { buildScene } from './scene.ts'
import type { Species } from './species.ts'

/** Two small drawings per species for the shell menu: the empty shell and the living animal. */
export type Thumbs = { shell: string; animal: string }

const WIDTH = 220
const HEIGHT = 150
const INK = new Color().setRGB(0.15, 0.15, 0.15, SRGBColorSpace)

const idle = (work: () => void) =>
  typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback(work, { timeout: 1500 })
    : window.setTimeout(work, 60)

/**
 * Draws the thumbnails one species at a time in idle moments and reports each
 * as it is ready. Returns a function that stops early. Without WebGL it simply
 * reports nothing, and the menu keeps its colour swatches.
 */
export function drawThumbs(
  list: Species[],
  ready: (id: string, thumbs: Thumbs) => void,
) {
  let stopped = false
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
  } catch {
    return () => {}
  }
  renderer.setPixelRatio(2)
  renderer.setSize(WIDTH, HEIGHT)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = NoToneMapping
  const scene = new Scene()
  scene.add(new AmbientLight(0xffffff, LIGHTS.drawn.ambient))
  const key = new DirectionalLight(0xffffff, LIGHTS.drawn.key)
  key.position.set(1, 0.9, 0.4)
  scene.add(key)
  const ink = new InkPass()
  ink.setSize(WIDTH, HEIGHT, 2)
  const camera = new OrthographicCamera(-1, 1, 1, -1, -5000, 5000)

  const draw = (species: Species, living: boolean) => {
    const adult = frameAt(startOf('adult') + 0.06, species, 'none')
    const frame = living
      ? adult
      : { ...adult, animal: 0, phase: 'remains' as const }
    const built = buildScene(species, frame, { cut: false, xray: false })
    const undo = inkify(built.group)
    scene.add(built.group)
    const target = built.view.target
    camera.position
      .copy(target)
      .add(new Vector3(260, 200, 520).normalize().multiplyScalar(1000))
    camera.lookAt(target)
    const half = Math.max(built.view.height * 0.42, built.view.width * 0.32)
    camera.top = half
    camera.bottom = -half
    camera.left = -half * (WIDTH / HEIGHT)
    camera.right = half * (WIDTH / HEIGHT)
    camera.updateProjectionMatrix()
    ink.forget()
    ink.render(renderer, scene, camera, {
      style: 0,
      ink: INK,
      depthEdge: half * 0.04,
    })
    const url = renderer.domElement.toDataURL('image/png')
    scene.remove(built.group)
    undo()
    built.dispose()
    return url
  }

  const queue = [...list]
  const next = () => {
    if (stopped) return
    const species = queue.shift()
    if (!species) return finish()
    try {
      ready(species.id, {
        shell: draw(species, false),
        animal: draw(species, true),
      })
    } catch (error) {
      console.warn('A shell menu drawing could not be made.', error)
    }
    idle(next)
  }
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    ink.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
  }
  idle(next)
  return () => {
    stopped = true
    finish()
  }
}
