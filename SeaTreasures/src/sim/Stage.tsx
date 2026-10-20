import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  NoToneMapping,
  Object3D,
  OrthographicCamera,
  PCFShadowMap,
  Plane,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Scene,
  ShadowMaterial,
  SpotLight,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { InkPass, inkify, LIGHTS } from './ink.ts'
import type { Look } from './ink.ts'
import { labelsIn } from './labels.ts'
import type { Label } from './labels.ts'
import type { LifeFrame } from './life.ts'
import type { Setting } from './seabed.ts'
import { buildSeafloor } from './seafloor.ts'
import { buildWater, submerge, water, waterFor } from './water.ts'
import type { WaterLight } from './water.ts'
import type { Scenery } from './seafloor.ts'
import { buildScene } from './scene.ts'
import type { Built } from './scene.ts'
import type { Species } from './species.ts'

export type Measure = {
  /** Screen pixels per millimetre of shell, as drawn now. */
  pxPerMm: number
  /** True when the view is magnified past true size to show something tiny. */
  magnified: boolean
}

export type StageEvent =
  | { type: 'hatch'; left: number }
  | { type: 'settle' }
  | { type: 'hold'; on: boolean }
  | { type: 'poke' }
  | { type: 'shell' }
  | { type: 'tumble' }
  | { type: 'pickup' }

/** Actions the page asks the stage to perform, so buttons and taps do the same thing. */
export type Pulse = {
  kind:
    | 'poke'
    | 'tumble'
    | 'pickup'
    | 'hatch'
    | 'settle'
    | 'front'
    | 'iso'
    | 'reset'
    | 'focus'
  at: number
  /** For `focus`: the label of the part to zoom to. */
  part?: string
}

/** A stable seed for the scenery, so a place always looks the same. */
const seedOf = (text: string) =>
  [...text].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7) ||
  1

function store<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    snapshot: () => value,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    report(next: T) {
      if (Object.is(value, next)) return
      value = next
      listeners.forEach((listener) => listener())
    },
  }
}
const failureStore = () => store<string | null>(null)
const partStore = () => store<Label[]>([])

/** Reads a CSS colour (any syntax the browser resolves) into a three.js colour. */
function cssColour(probe: HTMLElement, into: Color) {
  const value = getComputedStyle(probe).color
  const numbers = value.match(/[\d.]+/g)?.map(Number) ?? []
  if (numbers.length < 3) return into
  const unit = value.startsWith('color(') ? 1 : 255
  return into.setRGB(
    numbers[0]! / unit,
    numbers[1]! / unit,
    numbers[2]! / unit,
    SRGBColorSpace,
  )
}

/** Where the light comes from: high and to the right, so the flat shadow falls to the left. */
const SUN = new Vector3(1, 0.8, 0.3).normalize()

const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t))

export default function Stage({
  species,
  frame,
  cut,
  xray,
  actual,
  apart,
  pxPerMm,
  reducedMotion,
  pulse,
  setting,
  labels,
  look,
  turntable,
  selected,
  card,
  onPart,
  onMeasure,
  onEvent,
}: {
  species: Species
  frame: LifeFrame
  cut: boolean
  xray: boolean
  actual: boolean
  apart: number
  pxPerMm: number
  reducedMotion: boolean
  pulse: Pulse | null
  /** The seabed, beach or open water around the specimen. */
  setting: Setting
  /** Show leader-line labels on the parts. */
  labels: boolean
  /** 0 draws the specimen as an educational figure, 1 shows it realistically. */
  look: number
  /** Slowly turn the figure. */
  turntable: boolean
  /** The label the reader opened, if any. */
  selected: string | null
  /** The explanation for the selected label, shown beside it. */
  card?: ReactNode
  onPart: (text: string) => void
  onMeasure: (measure: Measure) => void
  onEvent: (event: StageEvent) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  // The card renders above the floating panels, in the ocean section that holds them all.
  const [cardHost, setCardHost] = useState<HTMLElement | null>(null)
  useEffect(() => setCardHost(host.current?.parentElement ?? null), [])
  const api = useRef<{
    update: () => void
    nudge: () => void
    reset: () => void
    dress: () => void
    pulse: (pulse: Pulse) => void
  } | null>(null)
  const latest = useRef({
    species,
    frame,
    cut,
    xray,
    actual,
    apart,
    pxPerMm,
    reducedMotion,
    labels,
    look,
    turntable,
    setting,
  })
  const [status] = useState(failureStore)
  const failure = useSyncExternalStore(status.subscribe, status.snapshot)
  const [partList] = useState(partStore)
  const parts = useSyncExternalStore(partList.subscribe, partList.snapshot)
  const measure = useEffectEvent(onMeasure)
  const emit = useEffectEvent(onEvent)

  useEffect(() => {
    latest.current = {
      ...latest.current,
      species,
      frame,
      cut,
      xray,
      actual,
      pxPerMm,
      reducedMotion,
    }
    api.current?.update()
  }, [species, frame, cut, xray, actual, pxPerMm, reducedMotion])

  useEffect(() => {
    latest.current = { ...latest.current, apart }
    api.current?.nudge()
  }, [apart])

  useEffect(() => {
    latest.current = { ...latest.current, labels, look, turntable }
    api.current?.nudge()
  }, [labels, look, turntable, parts, cut, xray, selected])

  // The card's size changes as its evidence opens: place it again whenever it does.
  useEffect(() => {
    const element = pop.current
    if (!element) return
    const watch = new ResizeObserver(() => api.current?.nudge())
    watch.observe(element)
    return () => watch.disconnect()
  }, [selected, Boolean(card)])

  useEffect(() => {
    latest.current = { ...latest.current, setting }
    api.current?.dress()
  }, [setting])

  useEffect(() => {
    api.current?.reset()
  }, [species.id])

  useEffect(() => {
    if (pulse) api.current?.pulse(pulse)
  }, [pulse])

  useEffect(() => {
    const container = host.current
    if (!container) return
    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true })
    } catch (error) {
      console.warn('3D unavailable; the timeline and facts still work.', error)
      status.report(
        '3D is unavailable on this device. The timeline, facts and sources still work.',
      )
      return
    }
    status.report(null)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = NoToneMapping
    renderer.localClippingEnabled = true
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFShadowMap
    renderer.domElement.setAttribute('aria-hidden', 'true')
    renderer.domElement.setAttribute('data-sim-canvas', '')
    container.prepend(renderer.domElement)

    const scene = new Scene()
    const ambient = new AmbientLight(0xffffff, LIGHTS.drawn.ambient)
    const sky = new HemisphereLight(0xffffff, 0x8a7f74, 0)
    const key = new DirectionalLight(0xffffff, LIGHTS.drawn.key)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.radius = 4
    const rim = new DirectionalLight(0xffffff, 0)
    scene.add(ambient, sky, key, key.target, rim)
    // A soft cast shadow on the paper: tinted in the drawing, neutral when realistic.
    const paper = new Mesh(new PlaneGeometry(1, 1), new ShadowMaterial())
    const shadowTint = new Color()
    const black = new Color(0, 0, 0)
    const light = (look: Look) => {
      const set = LIGHTS[look]
      ambient.intensity = set.ambient
      sky.intensity = set.hemisphere
      key.intensity = set.key
      rim.intensity = set.rim
      // Under water the sun is filtered from above and tinted by the water; the drawing stays neutral.
      const wet = look === 'real' && Boolean(scenery?.ground)
      const submerged = wet && latest.current.setting.scene !== 'beach'
      key.color.setRGB(1, submerged ? 0.97 : 1, submerged ? 0.9 : 1)
      sky.color.setRGB(submerged ? 0.75 : 1, submerged ? 0.92 : 1, 1)
      sky.groundColor.setRGB(0.55, 0.5, 0.45)
      torch.intensity = 0
      if (submerged) {
        // Daylight fades with depth, and is gone at night: then a diver's torch lights the animal.
        const day = waterLight.night ? 0.05 : waterLight.daylight
        const keep = 0.35 + 0.65 * day
        key.intensity = set.key * 0.62 * (0.25 + 0.75 * day)
        sky.intensity = set.hemisphere * 0.55 * keep
        ambient.intensity = set.ambient * 0.6 * keep
        rim.intensity = set.rim * 0.2 * day
        sky.color.setRGB(0.55 + 0.2 * day, 0.75 + 0.17 * day, 1)
        if (waterLight.night || day < 0.25) {
          torch.intensity = waterLight.night ? 9 : 5
          torch.position.copy(camera.position)
          torch.target.position.copy(controls.target)
          torch.target.updateMatrixWorld()
        }
      }
      paper.material.color.copy(look === 'drawn' ? shadowTint : black)
      paper.material.opacity = look === 'drawn' ? 0.42 : 0.3
      // Light rays, fish and drifting particles belong to the realistic water only; fish shelter at night.
      if (waterParts) {
        waterParts.group.visible = look === 'real'
        waterParts.group.traverse((object) => {
          if (object.userData.fish) object.visible = !waterLight.night
        })
      }
    }
    paper.rotation.x = -Math.PI / 2
    paper.receiveShadow = true
    scene.add(paper)
    // A diver's torch for night and the deep: a soft warm cone from the viewer.
    const torch = new SpotLight(0xfff1dc, 0, 0, 0.32, 0.65, 0)
    scene.add(torch, torch.target)
    let waterLight: WaterLight = { tone: [0, 0, 0], daylight: 1, night: false }
    const ink = new InkPass()
    const inkColour = new Color()
    const probe = (name: string) => {
      const element = document.createElement('span')
      element.className = `sim-probe sim-probe-${name}`
      element.setAttribute('aria-hidden', 'true')
      container.append(element)
      return element
    }
    const inkProbe = probe('ink')
    const shadowProbe = probe('shadow')
    let undoInk: (() => void) | null = null
    let labelled: Label[] = []

    const camera = new OrthographicCamera(-1, 1, 1, -1, -5000, 5000)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.minPolarAngle = 0.05
    controls.maxPolarAngle = Math.PI - 0.05
    /** Over a seabed the camera stays above it: the view can't swing under the ground. */
    const keepAbove = () => {
      const grounded = Boolean(scenery?.ground)
      controls.maxPolarAngle = grounded ? Math.PI / 2 - 0.06 : Math.PI - 0.05
    }
    controls.minZoom = 0.3
    controls.maxZoom = 6
    const home = () => {
      const target = controls.target.clone()
      // Over a seabed the view sits low, a diver's eye, so the floor runs back into open water.
      const low = Boolean(scenery?.ground) && !built?.close
      camera.position.set(
        target.x + 260,
        target.y + (low ? 130 : 220),
        target.z + 520,
      )
      camera.zoom = 1
      camera.updateProjectionMatrix()
      controls.update()
    }

    let built: Built | null = null
    let scenery: Scenery | null = null
    let undoScenery: (() => void) | null = null
    let waterParts: ReturnType<typeof buildWater> | null = null
    let waterCss = ''
    let sceneryKey = ''
    let ambientTimer = 0
    /** Room taken by the floating panels, in CSS pixels: the specimen is framed in what is left. */
    const safe = { left: 0, right: 0, top: 0, bottom: 0 }
    const readSafe = () => {
      const style = getComputedStyle(container)
      const read = (name: string) =>
        parseFloat(style.getPropertyValue(name)) || 0
      safe.left = read('--safe-left')
      safe.right = read('--safe-right')
      safe.top = read('--safe-top')
      safe.bottom = read('--safe-bottom')
    }
    home()
    let frameId = 0
    let visible = true
    let disposed = false
    const started = performance.now()
    const now = () => (performance.now() - started) / 1000

    const motion = {
      withdraw: Number.NEGATIVE_INFINITY,
      tumble: Number.NEGATIVE_INFINITY,
      tumbleFrom: new Quaternion(),
      tumbleTo: new Quaternion(),
      resting: new Quaternion(),
      pickup: Number.NEGATIVE_INFINITY,
      crabSince: Number.NEGATIVE_INFINITY,
      hadCrab: false,
      hatchedAt: new Map<number, number>(),
      larva: new Vector3(),
      larvaTarget: new Vector3(),
      settling: Number.NEGATIVE_INFINITY,
      larvaKey: '',
      apart: 0,
    }

    /** Millimetres per screen pixel at zoom 1, and where the view looks. */
    const frameSize = () => {
      const { actual, pxPerMm } = latest.current
      const width = container.clientWidth || 1
      const height = container.clientHeight || 1
      const free = {
        width: Math.max(width * 0.45, width - safe.left - safe.right),
        height: Math.max(height * 0.45, height - safe.top - safe.bottom),
      }
      if (!built)
        return { perPx: 100 / height, magnified: false, target: new Vector3() }
      if (actual)
        return {
          perPx: 1 / pxPerMm,
          magnified: false,
          target: built.view.target,
        }
      const view = built.close ?? built.view
      // With a seabed around it, step back so the specimen sits in its setting.
      const room = scenery?.ground && !built.close ? 2 : 1
      const perPx =
        Math.max(view.height / free.height, view.width / free.width) * room
      return { perPx, magnified: Boolean(built.close), target: view.target }
    }

    const aimAt = (target: Vector3) => {
      const offset = camera.position.clone().sub(controls.target)
      controls.target.copy(target)
      camera.position.copy(target).add(offset)
    }

    /** The frustum, re-derived from the zoom so the target stays centred in the free area. */
    const frustum = { perPx: 1, zoom: Number.NaN, width: 0, height: 0 }
    const frame = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      const { perPx } = frustum
      // The view's centre is offset in world units, which an orthographic zoom does not scale:
      // divide by the zoom so the offset stays a fixed number of screen pixels.
      const shiftX = (((safe.left - safe.right) / 2) * perPx) / camera.zoom
      const shiftY = (((safe.top - safe.bottom) / 2) * perPx) / camera.zoom
      camera.left = (-width / 2) * perPx - shiftX
      camera.right = (width / 2) * perPx - shiftX
      camera.top = (height / 2) * perPx + shiftY
      camera.bottom = (-height / 2) * perPx + shiftY
      camera.updateProjectionMatrix()
      frustum.zoom = camera.zoom
      frustum.width = width
      frustum.height = height
    }

    const fit = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (!width || !height) return
      readSafe()
      // The canvas fills the screen and is drawn in several passes: keep it under about 3.5 million pixels.
      renderer.setPixelRatio(
        Math.min(
          devicePixelRatio,
          1.75,
          Math.sqrt(3_500_000 / (width * height)),
        ),
      )
      renderer.setSize(width, height)
      const { perPx, magnified, target } = frameSize()
      if (!controls.target.equals(target)) aimAt(target)
      frustum.perPx = perPx
      controls.enableZoom = !latest.current.actual
      if (latest.current.actual) camera.zoom = 1
      frame()
      ink.setSize(width, height, renderer.getPixelRatio())
      measure({ pxPerMm: camera.zoom / perPx, magnified })
    }

    /** Builds the seabed again when the species, place, bed or scene changes. */
    const dress = () => {
      if (!built) return
      const { setting, species } = latest.current
      const key = `${setting.key}|${species.id}`
      if (key === sceneryKey) return
      sceneryKey = key
      if (scenery) {
        scene.remove(scenery.group)
        undoScenery?.()
        scenery.dispose()
      }
      if (waterParts) {
        scene.remove(waterParts.group)
        waterParts.dispose()
      }
      ink.forget()
      scenery = buildSeafloor(setting, built.extent, seedOf(key))
      undoScenery = inkify(scenery.group)
      submerge(scenery.group)
      waterParts = buildWater(setting, built.extent, seedOf(key) + 1)
      scene.add(waterParts.group)
      home()
      // Only the specimen casts a shadow: the scenery's own would cost more than it shows.
      scenery.group.traverse((object) => (object.castShadow = false))
      keepAbove()
      scene.add(scenery.group)
      paper.visible = !scenery.ground
      fit()
      request()
    }

    /** Puts a rolled shell back on the sand: its lowest point touches the floor, centred over it. */
    const rest = (target: Built) => {
      const specimen = target.specimen
      specimen.position.set(0, 0, 0)
      specimen.updateMatrixWorld(true)
      const box = new Box3().setFromObject(specimen)
      const centre = box.getCenter(new Vector3())
      specimen.position.set(-centre.x, target.floor - box.min.y, -centre.z)
      specimen.userData.base = specimen.position.clone()
    }

    const rebuild = () => {
      const { species, frame, cut, xray } = latest.current
      if (built) {
        scene.remove(built.group)
        undoInk?.()
        built.dispose()
      }
      ink.forget()
      built = buildScene(species, frame, { cut, xray })
      undoInk = inkify(built.group)
      submerge(built.group, true)
      scene.add(built.group)
      const extent = built.extent
      // The shadow falls on paper just under whatever is shown, so swimmers and larvae keep theirs close.
      const span = built.close
        ? Math.max(built.close.width, built.close.height)
        : extent
      const lowest = new Box3().setFromObject(built.specimen).min.y
      const ground = Number.isFinite(lowest)
        ? Math.max(built.floor, lowest - span * 0.08)
        : built.floor
      paper.scale.setScalar(Math.max(extent, span) * 10)
      paper.position.y = ground + span * 0.002
      key.target.position.set(0, ground, 0)
      key.target.updateMatrixWorld()
      key.position
        .copy(SUN)
        .multiplyScalar(span * 4)
        .add(key.target.position)
      rim.position.set(-span * 2, span * 0.8, -span * 2)
      const shade = key.shadow.camera
      shade.left = shade.bottom = -span * 2.2
      shade.right = shade.top = span * 2.2
      shade.near = span * 0.5
      shade.far = span * 9
      shade.updateProjectionMatrix()
      key.shadow.bias = -0.0005
      key.shadow.normalBias = span * 0.002
      labelled = labelsIn(built.group)
      partList.report(labelled)
      dress()
      if (frame.beach) {
        built.specimen.quaternion.multiply(motion.resting)
        rest(built)
      } else motion.resting.identity()
      const hasCrab = (built.rig?.crab.children.length ?? 0) > 0
      if (hasCrab && !motion.hadCrab) motion.crabSince = now()
      motion.hadCrab = hasCrab
      if (frame.phase !== 'egg') motion.hatchedAt.clear()
      if (frame.phase !== 'found') motion.pickup = Number.NEGATIVE_INFINITY
      const larvaKey = `${species.id}:${frame.phase === 'larva'}`
      if (larvaKey !== motion.larvaKey) {
        motion.larvaKey = larvaKey
        motion.settling = Number.NEGATIVE_INFINITY
        motion.larva.set(0, 0, 0)
        motion.larvaTarget.set(0, 0, 0)
      }
      fit()
    }

    /** Applies every transient motion; true while something is still moving. */
    const animate = () => {
      if (!built) return false
      const t = now()
      const calm = latest.current.reducedMotion
      const { frame } = latest.current
      let moving = false
      const rig = built.rig
      if (rig) {
        const since = t - motion.withdraw
        let shrink = 1
        if (Number.isFinite(since) && since >= 0 && since < 2.6) {
          moving = true
          shrink =
            since < 0.35
              ? 1 - 0.85 * ease(since / 0.35)
              : since < 1.6
                ? 0.15
                : 0.15 + 0.85 * ease(since - 1.6)
        }
        rig.outside.scale.setScalar(Math.max(0.01, shrink))
        const target = latest.current.apart
        motion.apart += (target - motion.apart) * (calm ? 1 : 0.18)
        if (Math.abs(target - motion.apart) > 0.002) moving = true
        rig.shell.userData.base ??= rig.shell.position.clone()
        rig.shell.position
          .copy(rig.shell.userData.base as Vector3)
          .add(new Vector3(0, rig.reach * motion.apart, 0))
        if (rig.crab.children.length) {
          const arrive = Number.isFinite(motion.crabSince)
            ? ease((t - motion.crabSince) / (calm ? 0.001 : 1.4))
            : 1
          rig.crab.position.set((1 - arrive) * built.extent * 0.9, 0, 0)
          if (arrive < 1) moving = true
        }
      }
      const specimen = built.specimen
      specimen.userData.base ??= specimen.position.clone()
      const base = specimen.userData.base as Vector3
      specimen.position.copy(base)
      if (built.bob > 0 && !calm) {
        specimen.position.y += Math.sin(t * 1.8) * built.bob
        moving = true
      }
      if (frame.larva > 0) {
        motion.larva.lerp(motion.larvaTarget, calm ? 1 : 0.08)
        const settle = Number.isFinite(motion.settling)
          ? ease((t - motion.settling) / (calm ? 0.001 : 1.2))
          : 0
        specimen.position.x += motion.larva.x * (1 - settle)
        specimen.position.y +=
          motion.larva.y * (1 - settle) -
          (built.close?.target.y ?? 0) * 0.6 * settle
        if (
          motion.larva.distanceTo(motion.larvaTarget) > 0.01 ||
          (Number.isFinite(motion.settling) && settle < 1)
        )
          moving = true
      }
      const tumbleSince = t - motion.tumble
      if (
        Number.isFinite(tumbleSince) &&
        tumbleSince >= 0 &&
        tumbleSince < 1.05
      ) {
        specimen.quaternion
          .copy(motion.tumbleFrom)
          .slerp(motion.tumbleTo, calm ? 1 : ease(tumbleSince))
        if (tumbleSince >= 1 || calm) {
          rest(built)
          specimen.position.copy(specimen.userData.base as Vector3)
        } else {
          specimen.position.y +=
            Math.sin(Math.min(1, tumbleSince) * Math.PI) * built.extent * 0.25
          moving = true
        }
      }
      const pickSince = t - motion.pickup
      if (Number.isFinite(pickSince) && pickSince >= 0) {
        const p = calm ? 1 : ease(pickSince / 0.9)
        specimen.position.y += p * built.extent * 0.25
        specimen.scale.setScalar(1 + p * 0.25)
        if (p < 1) moving = true
      } else specimen.scale.setScalar(1)
      for (const egg of built.eggs) {
        const at = motion.hatchedAt.get(egg.userData.egg as number)
        egg.userData.size ??= egg.scale.clone()
        if (at === undefined) continue
        const p = calm ? 1 : ease((t - at) / 0.5)
        egg.scale
          .copy(egg.userData.size as Vector3)
          .multiplyScalar(Math.max(0.001, 1 - p))
        if (p < 1) moving = true
      }
      return moving
    }

    const screen = new Vector3()
    const scaleOf = new Vector3()
    /** Places each label beside its part, with a leader line, without overlaps. */
    const placeLabels = () => {
      const root = layer.current
      if (!root || !built) return
      const { labels, cut, xray } = latest.current
      const width = container.clientWidth
      const height = container.clientHeight
      const toScreen = (point: Vector3) => {
        screen.copy(point).project(camera)
        return {
          x: (screen.x * 0.5 + 0.5) * width,
          y: (-screen.y * 0.5 + 0.5) * height,
        }
      }
      const centre = toScreen(
        new Box3().setFromObject(built.specimen).getCenter(new Vector3()),
      )
      const placed: {
        text: string
        x: number
        y: number
        lx: number
        ly: number
        side: number
      }[] = []
      for (const label of labelled) {
        if (!labels || (label.inside && !cut && !xray)) continue
        label.anchor.getWorldScale(scaleOf)
        if (scaleOf.x < 0.3 * (label.anchor.userData.scale0 ??= scaleOf.x))
          continue
        const at = toScreen(label.anchor.getWorldPosition(new Vector3()))
        if (at.x < 0 || at.y < 0 || at.x > width || at.y > height) continue
        const side = at.x >= centre.x ? 1 : -1
        placed.push({
          text: label.text,
          x: at.x,
          y: at.y,
          lx: at.x + side * 48,
          ly: at.y + (at.y - centre.y) * 0.18,
          side,
        })
      }
      for (const side of [-1, 1]) {
        const column = placed
          .filter((item) => item.side === side)
          .sort((a, b) => a.ly - b.ly)
        for (let i = 1; i < column.length; i++)
          column[i]!.ly = Math.max(column[i]!.ly, column[i - 1]!.ly + 30)
        const overflow =
          (column.at(-1)?.ly ?? 0) - (height - Math.max(24, safe.bottom + 12))
        if (overflow > 0) column.forEach((item) => (item.ly -= overflow))
        column.forEach(
          (item) => (item.ly = Math.max(Math.max(24, safe.top + 12), item.ly)),
        )
      }
      const shown = new Map(placed.map((item) => [item.text, item]))
      const near = width < 560 ? 26 : 48
      root.querySelectorAll<HTMLElement>('[data-part]').forEach((element) => {
        const item = shown.get(element.dataset.part ?? '')
        element.hidden = !item
        if (!item) return
        element.dataset.side = item.side > 0 ? 'right' : 'left'
        // Keep the whole label on the plate, even when its part sits near an edge.
        const wide = element.offsetWidth
        item.lx = item.x + item.side * near
        item.lx =
          item.side > 0
            ? Math.min(item.lx, width - safe.right - 6 - wide)
            : Math.max(item.lx, safe.left + 6 + wide)
        element.style.left = `${item.lx}px`
        element.style.top = `${item.ly}px`
      })
      root.querySelectorAll<SVGLineElement>('[data-leader]').forEach((line) => {
        const item = shown.get(line.dataset.leader ?? '')
        line.style.display = item ? '' : 'none'
        if (!item) return
        line.setAttribute('x1', String(item.x))
        line.setAttribute('y1', String(item.y))
        line.setAttribute('x2', String(item.lx - item.side * 4))
        line.setAttribute('y2', String(item.ly))
      })
      root.querySelectorAll<SVGCircleElement>('[data-dot]').forEach((dot) => {
        const item = shown.get(dot.dataset.dot ?? '')
        dot.style.display = item ? '' : 'none'
        if (!item) return
        dot.setAttribute('cx', String(item.x))
        dot.setAttribute('cy', String(item.y))
      })
      placeCard(root, shown, width, height)
    }

    /**
     * Puts the part card right beside its label: on the label's outer side when
     * there is room, otherwise the other side, otherwise below; always inside
     * the space the floating panels leave free.
     */
    const placeCard = (
      root: HTMLElement,
      shown: Map<string, { lx: number; ly: number; side: number }>,
      width: number,
      height: number,
    ) => {
      const card = pop.current
      if (!card) return
      const name = card.dataset.card ?? ''
      const item = shown.get(name)
      const tag = root.querySelector<HTMLElement>(
        `[data-part="${CSS.escape(name)}"]`,
      )
      if (!item || !tag) {
        card.hidden = true
        return
      }
      card.hidden = false
      // On a phone there is no room beside a label: the card becomes a sheet along the stage's foot.
      if (width < 600) {
        card.dataset.side = 'sheet'
        card.style.transform = ''
        return
      }
      const gap = 12
      const w = card.offsetWidth
      const h = card.offsetHeight
      const tagW = tag.offsetWidth
      const tagH = tag.offsetHeight
      const tagLeft = item.side > 0 ? item.lx : item.lx - tagW
      const tagRight = tagLeft + tagW
      // The floating panels, in the same coordinates: the card avoids covering them.
      const origin = container.getBoundingClientRect()
      const panels = [
        ...(container.parentElement?.querySelectorAll<HTMLElement>(
          ':scope > .float, :scope > .float-left > *',
        ) ?? []),
      ]
        .map((panel) => panel.getBoundingClientRect())
        .filter((box) => box.width && box.height)
        .map((box) => ({
          x: box.left - origin.left,
          y: box.top - origin.top,
          w: box.width,
          h: box.height,
        }))
      const overlap = (x: number, y: number) =>
        panels.reduce((sum, box) => {
          const ox = Math.min(x + w, box.x + box.w) - Math.max(x, box.x)
          const oy = Math.min(y + h, box.y + box.h) - Math.max(y, box.y)
          return sum + (ox > 0 && oy > 0 ? ox * oy : 0)
        }, 0)
      const fit = (x: number, y: number) => ({
        x: Math.min(Math.max(x, 8), Math.max(8, width - w - 8)),
        y: Math.min(Math.max(y, 8), Math.max(8, height - h - 8)),
      })
      const outer = item.side > 0 ? 'right' : 'left'
      const sides =
        outer === 'right'
          ? (['right', 'left', 'below', 'above'] as const)
          : (['left', 'right', 'below', 'above'] as const)
      let best: {
        side: (typeof sides)[number]
        x: number
        y: number
        cost: number
      } | null = null
      sides.forEach((side, rank) => {
        const raw =
          side === 'right'
            ? { x: tagRight + gap, y: item.ly - Math.min(28, h / 2) }
            : side === 'left'
              ? { x: tagLeft - gap - w, y: item.ly - Math.min(28, h / 2) }
              : side === 'below'
                ? { x: tagLeft + tagW / 2 - w / 2, y: item.ly + tagH / 2 + gap }
                : {
                    x: tagLeft + tagW / 2 - w / 2,
                    y: item.ly - tagH / 2 - gap - h,
                  }
        const at = fit(raw.x, raw.y)
        // Being pushed off its side (by the screen edge) or onto a panel costs; so does a later preference.
        const shift = Math.abs(at.x - raw.x) + Math.abs(at.y - raw.y)
        const cost = overlap(at.x, at.y) + shift * 40 + rank * 400
        if (!best || cost < best.cost) best = { side, ...at, cost }
      })
      const chosen = best!
      card.dataset.side = chosen.side
      card.style.transform = `translate(${Math.round(chosen.x)}px, ${Math.round(chosen.y)}px)`
      const aim =
        chosen.side === 'below' || chosen.side === 'above'
          ? tagLeft + tagW / 2 - chosen.x
          : item.ly - chosen.y
      card.style.setProperty(
        '--aim',
        `${Math.round(Math.min(Math.max(aim, 16), (chosen.side === 'below' || chosen.side === 'above' ? w : h) - 16))}px`,
      )
    }

    const draw = () => {
      frameId = 0
      if (disposed || !visible || document.hidden) return
      let moving = animate()
      const { turntable, reducedMotion, look } = latest.current
      controls.autoRotate = turntable && !reducedMotion
      controls.autoRotateSpeed = 1.2
      if (controls.autoRotate) moving = true
      const ambient = Boolean(scenery?.animated || waterParts) && !reducedMotion
      if (ambient) {
        scenery?.sway(now())
        waterParts?.animate(now())
        water.time.value = now()
      }
      water.centre.value.copy(controls.target)
      if (built) {
        waterLight = waterFor(
          latest.current.setting,
          built.extent,
          document.documentElement.dataset.theme === 'dark',
        )
        const css = `rgb(${waterLight.tone.join(' ')})`
        if (css !== waterCss) {
          waterCss = css
          container.parentElement?.style.setProperty('--water', css)
        }
      }
      controls.update()
      if (camera.zoom !== frustum.zoom) frame()
      cssColour(shadowProbe, shadowTint)
      ink.render(renderer, scene, camera, {
        style: look,
        ink: cssColour(inkProbe, inkColour),
        depthEdge: ((camera.top - camera.bottom) / camera.zoom) * 0.02,
        light,
        haze:
          scenery?.ground && built
            ? {
                from:
                  camera.position.distanceTo(controls.target) +
                  built.extent * 3,
                to:
                  camera.position.distanceTo(controls.target) +
                  built.extent * 14,
              }
            : null,
      })
      placeLabels()
      // controls.update() may already have asked for the next frame through its change event.
      if (moving && !frameId) frameId = requestAnimationFrame(draw)
      else if (ambient && !frameId && !ambientTimer)
        // The water's slow sway only needs about 25 frames a second.
        ambientTimer = window.setTimeout(() => {
          ambientTimer = 0
          request()
        }, 40)
    }
    const request = () => {
      if (!disposed && !frameId && visible && !document.hidden)
        frameId = requestAnimationFrame(draw)
    }

    const observer = new ResizeObserver(() => {
      fit()
      request()
    })
    observer.observe(container)
    const sight = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting)
      if (visible) request()
    })
    sight.observe(container)
    const visibility = () => request()
    document.addEventListener('visibilitychange', visibility)
    // Ink and shadow colours follow the light or dark theme.
    const themeWatch = new MutationObserver(() => request())
    themeWatch.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    })
    const scheme = matchMedia('(prefers-color-scheme: dark)')
    scheme.addEventListener('change', visibility)
    let reported = ''
    controls.addEventListener('change', () => {
      if (!latest.current.actual) {
        const size = frameSize()
        const pxPerMm = camera.zoom / size.perPx
        // Turning (and the turntable) fire this every frame; only zooming changes the scale.
        const key = `${pxPerMm.toFixed(4)}:${size.magnified}`
        if (key !== reported) {
          reported = key
          measure({ pxPerMm, magnified: size.magnified })
        }
      }
      request()
    })

    const raycaster = new Raycaster()
    const pointer = new Vector2()
    const aim = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
    }
    const pick = (event: PointerEvent, targets: Object3D[]) => {
      aim(event)
      return raycaster.intersectObjects(targets, true)[0] ?? null
    }
    const steer = (event: PointerEvent) => {
      if (!built) return
      aim(event)
      const centre = built.close?.target ?? new Vector3()
      const plane = new Plane().setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(new Vector3()).negate(),
        centre,
      )
      const point = raycaster.ray.intersectPlane(plane, new Vector3())
      if (!point) return
      // An offset from the larva's resting place, kept inside the close-up so it never leaves view.
      const room = built.close ? built.close.height * 0.3 : 0
      const offset = point.sub(centre)
      motion.larvaTarget.set(
        Math.max(-room * 1.4, Math.min(room * 1.4, offset.x)),
        Math.max(-room, Math.min(room, offset.y)),
        0,
      )
      request()
    }

    const actions = {
      hatch(index?: number) {
        if (!built) return
        const left = built.eggs.filter(
          (egg) => !motion.hatchedAt.has(egg.userData.egg as number),
        )
        for (const egg of left) {
          if (index !== undefined && egg.userData.egg !== index) continue
          motion.hatchedAt.set(egg.userData.egg as number, now())
        }
        emit({ type: 'hatch', left: built.eggs.length - motion.hatchedAt.size })
        request()
      },
      settle() {
        motion.settling = now()
        request()
        window.setTimeout(
          () => emit({ type: 'settle' }),
          latest.current.reducedMotion ? 0 : 1200,
        )
      },
      poke() {
        motion.withdraw = now()
        emit({ type: 'poke' })
        request()
      },
      tumble() {
        if (!built) return
        motion.tumbleFrom.copy(built.specimen.quaternion)
        const axis = new Vector3(
          Math.random() - 0.5,
          Math.random() * 0.4,
          Math.random() - 0.5,
        ).normalize()
        const turn = new Quaternion().setFromAxisAngle(
          axis,
          Math.PI * (0.6 + Math.random()),
        )
        motion.tumbleTo.copy(built.specimen.quaternion).multiply(turn)
        motion.resting.multiply(turn)
        motion.tumble = now()
        emit({ type: 'tumble' })
        request()
      },
      front() {
        // Straight from the side, like a plate in a field guide.
        const offset = camera.position.clone().sub(controls.target)
        camera.position
          .copy(controls.target)
          .add(new Vector3(0, offset.length() * 0.08, offset.length()))
        controls.update()
        request()
      },
      iso() {
        home()
        request()
      },
      reset() {
        aimAt(frameSize().target)
        home()
        request()
      },
      focus(part?: string) {
        const label = labelled.find((item) => item.text === part)
        if (!label) return
        aimAt(label.anchor.getWorldPosition(new Vector3()))
        if (!latest.current.actual)
          camera.zoom = Math.min(controls.maxZoom, Math.max(camera.zoom, 2.6))
        camera.updateProjectionMatrix()
        controls.update()
        request()
      },
      pickup() {
        motion.pickup = now()
        request()
        window.setTimeout(
          () => emit({ type: 'pickup' }),
          latest.current.reducedMotion ? 0 : 900,
        )
      },
    }

    let down: { x: number; y: number; at: number } | null = null
    let holding = false
    const release = () => {
      if (holding) emit({ type: 'hold', on: false })
      holding = false
      controls.enabled = true
    }
    const pointerdown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY, at: performance.now() }
      if (
        built &&
        latest.current.frame.phase === 'growth' &&
        pick(event, [built.specimen])
      ) {
        holding = true
        controls.enabled = false
        emit({ type: 'hold', on: true })
      }
    }
    const pointerup = (event: PointerEvent) => {
      const wasHolding = holding
      release()
      if (!down || !built) return
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y)
      const quick = performance.now() - down.at < 450
      down = null
      if (moved > 6 || !quick || wasHolding) return
      const { frame } = latest.current
      if (frame.phase === 'egg') {
        const hit = pick(event, built.eggs)
        if (hit) actions.hatch(hit.object.userData.egg as number)
      } else if (frame.phase === 'larva') steer(event)
      else if (pick(event, [built.specimen])) {
        if (frame.phase === 'adult') actions.poke()
        else if (frame.phase === 'remains') emit({ type: 'shell' })
        else if (frame.phase === 'beach') actions.tumble()
        else if (frame.phase === 'found') actions.pickup()
      }
    }
    const pointermove = (event: PointerEvent) => {
      if (
        latest.current.frame.larva > 0 &&
        event.pointerType === 'mouse' &&
        !down
      )
        steer(event)
    }
    const pointercancel = () => {
      release()
      down = null
    }
    renderer.domElement.addEventListener('pointerdown', pointerdown)
    renderer.domElement.addEventListener('pointerup', pointerup)
    renderer.domElement.addEventListener('pointermove', pointermove)
    renderer.domElement.addEventListener('pointercancel', pointercancel)

    const keydown = (event: KeyboardEvent) => {
      if (
        event.target !== container ||
        event.altKey ||
        event.metaKey ||
        event.ctrlKey
      )
        return
      const step = 0.18
      if (event.key === 'Home') home()
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const offset = camera.position.clone().sub(controls.target)
        offset.applyAxisAngle(
          camera.up,
          event.key === 'ArrowLeft' ? -step : step,
        )
        camera.position.copy(controls.target).add(offset)
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const offset = camera.position.clone().sub(controls.target)
        const side = offset.clone().cross(camera.up).normalize()
        offset.applyAxisAngle(side, event.key === 'ArrowUp' ? step : -step)
        // Clamp like the drag does, so the keys can't take the view under the ground either.
        const polar = Math.acos(
          Math.min(1, Math.max(-1, offset.y / offset.length())),
        )
        if (polar >= controls.minPolarAngle && polar <= controls.maxPolarAngle)
          camera.position.copy(controls.target).add(offset)
      } else return
      event.preventDefault()
      controls.update()
      request()
    }
    container.addEventListener('keydown', keydown)

    const lost = (event: Event) => {
      event.preventDefault()
      status.report(
        '3D was interrupted. The timeline, facts and sources still work.',
      )
    }
    renderer.domElement.addEventListener('webglcontextlost', lost)

    api.current = {
      update() {
        rebuild()
        request()
      },
      nudge: request,
      reset() {
        home()
        request()
      },
      dress,
      pulse(next) {
        if (next.kind === 'focus') actions.focus(next.part)
        else actions[next.kind]()
      },
    }
    rebuild()
    request()
    return () => {
      disposed = true
      cancelAnimationFrame(frameId)
      api.current = null
      observer.disconnect()
      sight.disconnect()
      document.removeEventListener('visibilitychange', visibility)
      container.removeEventListener('keydown', keydown)
      renderer.domElement.removeEventListener('pointerdown', pointerdown)
      renderer.domElement.removeEventListener('pointerup', pointerup)
      renderer.domElement.removeEventListener('pointermove', pointermove)
      renderer.domElement.removeEventListener('pointercancel', pointercancel)
      renderer.domElement.removeEventListener('webglcontextlost', lost)
      window.clearTimeout(ambientTimer)
      if (scenery) {
        undoScenery?.()
        scenery.dispose()
      }
      waterParts?.dispose()
      themeWatch.disconnect()
      scheme.removeEventListener('change', visibility)
      controls.dispose()
      key.dispose()
      undoInk?.()
      if (built) built.dispose()
      ink.dispose()
      paper.geometry.dispose()
      paper.material.dispose()
      inkProbe.remove()
      shadowProbe.remove()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [status, partList])

  return (
    <div
      className={`sim-stage${failure ? ' has-failure' : ''}`}
      ref={host}
      tabIndex={0}
      role="group"
      aria-label="Shell view. Drag or use the arrow keys to turn it; Home resets the view. Tap to interact."
      aria-describedby="sim-summary"
      data-phase={frame.phase}
    >
      {failure && (
        <p className="sim-failure" role="status">
          {failure}
        </p>
      )}
      <div className="sim-labels" ref={layer} hidden={!labels}>
        <svg aria-hidden="true">
          {parts.map((part) => (
            <g key={part.text}>
              <line data-leader={part.text} />
              <circle data-dot={part.text} r="2.5" />
            </g>
          ))}
        </svg>
        <ul aria-label="Labelled parts">
          {parts.map((part) => (
            <li key={part.text} data-part={part.text} hidden>
              <button
                type="button"
                aria-pressed={selected === part.text}
                onClick={() => onPart(part.text)}
              >
                {part.text}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {card &&
        selected &&
        cardHost &&
        createPortal(
          <div className="part-pop" data-card={selected} ref={pop} hidden>
            {card}
          </div>,
          cardHost,
        )}
    </div>
  )
}
