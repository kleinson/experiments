import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  DirectionalLight,
  HemisphereLight,
  Material,
  Matrix4,
  Mesh,
  Object3D,
  OrthographicCamera,
  PMREMGenerator,
  PCFShadowMap,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { frameAt, startOf } from './life.ts'
import { buildScene } from './scene.ts'
import type { Species } from './species.ts'

/**
 * Studio pictures for the shell menu, like a specimen photographed on a
 * table: the realistic materials under soft daylight, a faint contact shadow
 * and no background. Three views per species: the shell from above, its
 * underside with the opening, and the living animal.
 */
export type Thumbs = { shell: string; underside: string; animal: string }

const idle = (work: () => void) =>
  typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback(work, { timeout: 1500 })
    : window.setTimeout(work, 60)

type View = 'shell' | 'underside' | 'animal'
const SIZES: Record<View, [number, number]> = {
  shell: [320, 288],
  underside: [120, 96],
  animal: [120, 96],
}
/** Camera directions: a three-quarter product shot, straight down onto the underside, and side-on. */
const DIRECTIONS: Record<View, Vector3> = {
  shell: new Vector3(0.35, 1.25, 0.9).normalize(),
  underside: new Vector3(0.15, 1, 0.35).normalize(),
  animal: new Vector3(0.9, 0.45, 1).normalize(),
}

const MARGIN: Record<View, number> = {
  shell: 1.12,
  underside: 1.12,
  animal: 1.12,
}

function visibleAll(object: Object3D) {
  for (let item: Object3D | null = object; item; item = item.parent)
    if (!item.visible) return false
  return true
}

/** The extent of a group's visible vertices in camera space. */
function projectedOutline(root: Object3D, camera: OrthographicCamera) {
  const outline = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  }
  const point = new Vector3()
  const toCamera = new Matrix4()
  root.traverse((object) => {
    if (!(object instanceof Mesh) || !visibleAll(object)) return
    const materials = [object.material].flat() as Material[]
    if (
      materials.every(
        (material) => !material.visible || material.opacity < 0.05,
      )
    )
      return
    const positions = object.geometry.getAttribute('position')
    if (!positions) return
    toCamera.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld)
    const step = Math.max(1, Math.floor(positions.count / 4000))
    for (let i = 0; i < positions.count; i += step) {
      point.fromBufferAttribute(positions, i).applyMatrix4(toCamera)
      outline.minX = Math.min(outline.minX, point.x)
      outline.maxX = Math.max(outline.maxX, point.x)
      outline.minY = Math.min(outline.minY, point.y)
      outline.maxY = Math.max(outline.maxY, point.y)
    }
  })
  if (!Number.isFinite(outline.minX))
    return { minX: -1, maxX: 1, minY: -1, maxY: 1 }
  return outline
}

/**
 * Draws the pictures one species at a time in idle moments and reports each as
 * it is ready. Returns a function that stops early. Without WebGL it reports
 * nothing, and the menu keeps its colour swatches.
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
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.8
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.localClippingEnabled = true
  renderer.setClearColor(0x000000, 0)

  const scene = new Scene()
  // A soft studio room reflected in the shells: what makes a glossy cowrie read as porcelain.
  const pmrem = new PMREMGenerator(renderer)
  const studio = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = studio
  scene.environmentIntensity = 0.45
  scene.add(new AmbientLight(0xffffff, 0.3))
  scene.add(new HemisphereLight(0xffffff, 0xb8a58c, 0.55))
  const key = new DirectionalLight(0xffffff, 1.9)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.radius = 6
  scene.add(key, key.target)
  const fill = new DirectionalLight(0xffffff, 0.7)
  scene.add(fill)
  const table = new Mesh(
    new PlaneGeometry(1, 1),
    new ShadowMaterial({ opacity: 0.16 }),
  )
  table.rotation.x = -Math.PI / 2
  table.receiveShadow = true
  scene.add(table)
  const camera = new OrthographicCamera(-1, 1, 1, -1, -5000, 5000)

  const draw = (species: Species, view: View) => {
    const adult = frameAt(startOf('adult') + 0.06, species, 'none')
    const frame =
      view === 'animal'
        ? adult
        : { ...adult, animal: 0, phase: 'remains' as const, wear: 0 }
    const built = buildScene(species, frame, { cut: false, xray: false })
    scene.add(built.group)
    if (view === 'underside') built.specimen.rotation.x = Math.PI
    built.group.traverse((object) => {
      if (object instanceof Mesh) object.castShadow = true
    })
    built.group.updateMatrixWorld(true)
    const box = new Box3().setFromObject(built.specimen)
    const centre = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    const span = Math.max(size.x, size.y, size.z)
    // Rest the specimen on the table.
    built.group.position.y -= box.min.y
    centre.y -= box.min.y
    table.position.y = 0.01
    table.scale.setScalar(span * 6)
    key.position.set(-span * 1.2, span * 3, span * 1.6)
    key.target.position.copy(centre)
    key.target.updateMatrixWorld()
    const shade = key.shadow.camera
    shade.left = shade.bottom = -span * 1.5
    shade.right = shade.top = span * 1.5
    shade.near = span * 0.1
    shade.far = span * 8
    shade.updateProjectionMatrix()
    fill.position.set(span * 2, span, -span)
    const [width, height] = SIZES[view]
    renderer.setSize(width, height)
    camera.position.copy(centre).addScaledVector(DIRECTIONS[view], span * 3)
    camera.lookAt(centre)
    camera.updateMatrixWorld()
    // Frame what the camera actually sees: the projected outline of the visible
    // meshes, not their bounding box, which leaves the shell small in its card.
    built.group.updateMatrixWorld(true)
    const outline = projectedOutline(built.specimen, camera)
    const cx = (outline.maxX + outline.minX) / 2
    const cy = (outline.maxY + outline.minY) / 2
    const half =
      Math.max(
        (outline.maxY - outline.minY) / 2,
        ((outline.maxX - outline.minX) / 2) * (height / width),
      ) * MARGIN[view]
    camera.top = cy + half
    camera.bottom = cy - half
    camera.left = cx - half * (width / height)
    camera.right = cx + half * (width / height)
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
    const url = renderer.domElement.toDataURL('image/png')
    scene.remove(built.group)
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
        shell: draw(species, 'shell'),
        underside: draw(species, 'underside'),
        animal: draw(species, 'animal'),
      })
    } catch (error) {
      console.warn('A shell menu picture could not be made.', error)
    }
    idle(next)
  }
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    studio.dispose()
    pmrem.dispose()
    table.geometry.dispose()
    table.material.dispose()
    key.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
  }
  idle(next)
  return () => {
    stopped = true
    finish()
  }
}
