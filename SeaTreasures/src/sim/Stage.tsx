import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  DirectionalLight,
  HemisphereLight,
  Object3D,
  OrthographicCamera,
  Plane,
  Quaternion,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { LifeFrame } from './life.ts'
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
  kind: 'poke' | 'tumble' | 'pickup' | 'hatch' | 'settle'
  at: number
}

function failureStore() {
  let message: string | null = null
  const listeners = new Set<() => void>()
  return {
    snapshot: () => message,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    report(next: string | null) {
      if (message === next) return
      message = next
      listeners.forEach((listener) => listener())
    },
  }
}

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
  onMeasure: (measure: Measure) => void
  onEvent: (event: StageEvent) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<{
    update: () => void
    nudge: () => void
    reset: () => void
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
  })
  const [status] = useState(failureStore)
  const failure = useSyncExternalStore(status.subscribe, status.snapshot)
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
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.localClippingEnabled = true
    renderer.domElement.setAttribute('aria-hidden', 'true')
    renderer.domElement.setAttribute('data-sim-canvas', '')
    container.prepend(renderer.domElement)

    const scene = new Scene()
    scene.add(new HemisphereLight(0xffffff, 0x8a7f74, 1.6))
    scene.add(new AmbientLight(0xffffff, 0.5))
    const key = new DirectionalLight(0xffffff, 2.6)
    key.position.set(-120, 220, 160)
    scene.add(key)
    const rim = new DirectionalLight(0xffffff, 1.1)
    rim.position.set(160, 60, -140)
    scene.add(rim)

    const camera = new OrthographicCamera(-1, 1, 1, -1, -5000, 5000)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.minPolarAngle = 0.05
    controls.maxPolarAngle = Math.PI - 0.05
    controls.minZoom = 0.5
    controls.maxZoom = 6
    const home = () => {
      const target = controls.target.clone()
      camera.position.set(target.x + 260, target.y + 220, target.z + 520)
      camera.zoom = 1
      camera.updateProjectionMatrix()
      controls.update()
    }
    home()

    let built: Built | null = null
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

    /** Vertical millimetres the view spans, and where it looks. */
    const frameSize = () => {
      const { actual, pxPerMm } = latest.current
      const width = container.clientWidth || 1
      const height = container.clientHeight || 1
      if (!built) return { mm: 100, magnified: false, target: new Vector3() }
      const view = !actual && built.close ? built.close : built.view
      if (actual)
        return {
          mm: height / pxPerMm,
          magnified: false,
          target: built.view.target,
        }
      const mm = Math.max(view.height, view.width * (height / width))
      return { mm, magnified: Boolean(built.close), target: view.target }
    }

    const fit = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (!width || !height) return
      renderer.setSize(width, height)
      const { mm, magnified, target } = frameSize()
      if (!controls.target.equals(target)) {
        const offset = camera.position.clone().sub(controls.target)
        controls.target.copy(target)
        camera.position.copy(target).add(offset)
      }
      const half = mm / 2
      camera.top = half
      camera.bottom = -half
      camera.left = -half * (width / height)
      camera.right = half * (width / height)
      controls.enableZoom = !latest.current.actual
      if (latest.current.actual) camera.zoom = 1
      camera.updateProjectionMatrix()
      measure({ pxPerMm: (height / mm) * camera.zoom, magnified })
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
        built.dispose()
      }
      built = buildScene(species, frame, { cut, xray })
      scene.add(built.group)
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

    const draw = () => {
      frameId = 0
      if (disposed || !visible || document.hidden) return
      const moving = animate()
      controls.update()
      renderer.render(scene, camera)
      if (moving) frameId = requestAnimationFrame(draw)
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
    controls.addEventListener('change', () => {
      if (!latest.current.actual) {
        const height = container.clientHeight || 1
        const size = frameSize()
        measure({
          pxPerMm: (height / size.mm) * camera.zoom,
          magnified: size.magnified,
        })
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
      pulse(next) {
        actions[next.kind]()
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
      controls.dispose()
      if (built) built.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [status])

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
    </div>
  )
}
