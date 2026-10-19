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
  BackSide,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  createShellGeometry,
  createSpireGeometry,
  makeSpots,
  shellPoint,
} from './geometry.ts'
import { getShape } from './model.ts'
import type { ShellState } from './model.ts'
import { ShellFallback } from './ShellFallback.tsx'

export type ShellView = 'dorsal' | 'aperture' | 'free'
type Update = (state: ShellState, view: ShellView) => void

function rendererStatus() {
  let message: string | null = null
  const listeners = new Set<() => void>()
  return {
    snapshot: () => message,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    report(next: string | null) {
      if (message === next) return
      message = next
      listeners.forEach((listener) => listener())
    },
  }
}

function texture(colors: { shell: string; spots: string }) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) throw new Error('The specimen texture could not be created.')
  context.fillStyle = colors.shell
  context.fillRect(0, 0, canvas.width, canvas.height)
  for (const spot of makeSpots()) {
    context.globalAlpha = spot.opacity
    context.fillStyle = colors.spots
    context.beginPath()
    context.ellipse(
      spot.u * canvas.width,
      spot.v * canvas.height,
      spot.size * canvas.width,
      spot.size * canvas.height * spot.stretch,
      spot.angle,
      0,
      Math.PI * 2,
    )
    context.fill()
  }
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  return map
}

export default function ShellFigure({
  state,
  view,
  reducedMotion,
  theme,
  onManualTurn,
}: {
  state: ShellState
  view: ShellView
  reducedMotion: boolean
  theme: string
  onManualTurn: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const update = useRef<Update | null>(null)
  const rememberedCamera = useRef<{
    position: Vector3
    target: Vector3
    zoom: number
  } | null>(null)
  const [status] = useState(rendererStatus)
  const failure = useSyncExternalStore(status.subscribe, status.snapshot)
  const initializeState = useEffectEvent(() => {
    update.current?.(state, view)
  })
  const manualTurn = useEffectEvent(onManualTurn)
  const restoreCamera = useEffectEvent(
    (camera: OrthographicCamera, controls: OrbitControls) => {
      const remembered = rememberedCamera.current
      if (view !== 'free' || !remembered) return
      camera.position.copy(remembered.position)
      camera.zoom = remembered.zoom
      controls.target.copy(remembered.target)
      camera.updateProjectionMatrix()
      controls.update()
    },
  )

  useEffect(() => {
    const container = host.current
    if (!container) return
    const css = getComputedStyle(document.documentElement)
    const color = (name: string) => css.getPropertyValue(name).trim()
    const colors = {
      shell: color('--cp-shell'),
      spots: color('--cp-shell-spot'),
      lip: color('--cp-shell-lip'),
      accent: color('--cp-accent'),
    }
    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true })
    } catch (error) {
      console.warn(
        '3D shell unavailable; using the interactive illustration.',
        error,
      )
      status.report(
        '3D is unavailable here. The illustrated model and all controls still work.',
      )
      return
    }
    status.report(null)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.domElement.setAttribute('aria-hidden', 'true')
    renderer.domElement.setAttribute('data-shell-canvas', '')
    container.prepend(renderer.domElement)

    const scene = new Scene()
    const camera = new OrthographicCamera(-2.5, 2.5, 1.85, -1.85, 0.1, 40)
    camera.position.set(1.2, 2.65, 5)
    camera.lookAt(0, 0, 0)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.enableDamping = !reducedMotion
    controls.dampingFactor = 0.12
    controls.minZoom = 0.75
    controls.maxZoom = 1.6
    controls.minPolarAngle = 0.1
    controls.maxPolarAngle = Math.PI - 0.1
    controls.target.set(0, 0, 0)
    restoreCamera(camera, controls)

    scene.add(new AmbientLight(colors.shell, 2.3))
    const key = new DirectionalLight(colors.shell, 3.8)
    key.position.set(-2, 6, 3)
    scene.add(key)
    const rim = new DirectionalLight(colors.shell, 1.6)
    rim.position.set(3, 1, -3)
    scene.add(rim)
    const ventralFill = new DirectionalLight(colors.shell, 1.1)
    ventralFill.position.set(0, -4, 4)
    scene.add(ventralFill)

    const map = texture(colors)
    const shellMaterial = new MeshPhysicalMaterial({
      map,
      roughness: 0.26,
      metalness: 0,
      clearcoat: 0.8,
      clearcoatRoughness: 0.21,
      side: DoubleSide,
    })
    const lipMaterial = new MeshPhysicalMaterial({
      color: colors.lip,
      roughness: 0.3,
      side: DoubleSide,
    })
    const mantleMaterial = new MeshPhysicalMaterial({
      color: colors.accent,
      roughness: 0.65,
      side: DoubleSide,
    })
    const darkMaterial = new MeshBasicMaterial({
      color: colors.spots,
      side: BackSide,
    })
    const spireMaterial = new MeshPhysicalMaterial({
      color: colors.lip,
      roughness: 0.5,
      transparent: true,
    })
    const repairMaterial = new MeshBasicMaterial({ color: colors.accent })
    const growthRimMaterial = new MeshBasicMaterial({ color: colors.accent })
    const shell = new Mesh(new BufferGeometry(), shellMaterial)
    const inner = new Mesh(new BufferGeometry(), darkMaterial)
    const leftMantle = new Mesh(new BufferGeometry(), mantleMaterial)
    const rightMantle = new Mesh(new BufferGeometry(), mantleMaterial)
    const teethGeometry = new SphereGeometry(1, 8, 6)
    const teeth = new InstancedMesh(teethGeometry, lipMaterial, 52)
    const growthRims = [-1, 1].map(
      () => new Mesh(new BufferGeometry(), growthRimMaterial),
    )
    const lipCurve = new CatmullRomCurve3(
      Array.from({ length: 51 }, (_, i) => {
        const p = shellPoint(0.06 + (i / 50) * 0.88, Math.PI - 0.08, 100)
        return new Vector3(p.x, p.y, p.z)
      }),
    )
    const lip = new Mesh(
      new TubeGeometry(lipCurve, 64, 0.035, 6, false),
      lipMaterial,
    )
    const coil = new Mesh(createSpireGeometry(), spireMaterial)
    const foot = new Mesh(new SphereGeometry(1, 40, 20), mantleMaterial)
    foot.scale.set(1.9, 0.11, 0.83)
    foot.position.set(-0.1, -0.57, 0)
    const tentacles = [-1, 1].map((side) => {
      const curve = new CatmullRomCurve3([
        new Vector3(-1.55, -0.53, side * 0.25),
        new Vector3(-1.95, -0.42, side * 0.3),
        new Vector3(-2.05, -0.24, side * 0.4),
      ])
      return new Mesh(
        new TubeGeometry(curve, 16, 0.025, 6, false),
        mantleMaterial,
      )
    })
    const repairPoints = Array.from({ length: 35 }, (_, i) => {
      const t = i / 34
      const p = shellPoint(0.35 + t * 0.2, -0.65 + t * 1.25, 100, -0.012)
      return new Vector3(p.x, p.y, p.z)
    })
    const repair = new Mesh(
      new TubeGeometry(new CatmullRomCurve3(repairPoints), 40, 0.014, 6, false),
      repairMaterial,
    )
    const specimen = new Group()
    specimen.add(
      shell,
      inner,
      leftMantle,
      rightMantle,
      teeth,
      ...growthRims,
      lip,
      coil,
      foot,
      ...tentacles,
      repair,
    )
    specimen.rotation.z = -0.12
    scene.add(specimen)

    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = shadowCanvas.height = 128
    const shadowContext = shadowCanvas.getContext('2d')
    if (shadowContext) {
      const shadowColor = new Color(colors.spots)
      const rgb = `${Math.round(shadowColor.r * 255)},${Math.round(shadowColor.g * 255)},${Math.round(shadowColor.b * 255)}`
      const gradient = shadowContext.createRadialGradient(64, 64, 0, 64, 64, 64)
      gradient.addColorStop(0, `rgba(${rgb},0.19)`)
      gradient.addColorStop(1, `rgba(${rgb},0)`)
      shadowContext.fillStyle = gradient
      shadowContext.fillRect(0, 0, 128, 128)
    }
    const shadowMap = new CanvasTexture(shadowCanvas)
    const shadowMaterial = new MeshBasicMaterial({
      map: shadowMap,
      transparent: true,
      depthWrite: false,
    })
    const shadow = new Mesh(new PlaneGeometry(5, 2.7), shadowMaterial)
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -0.9
    scene.add(shadow)

    let frame = 0
    let visible = true
    let disposed = false
    const draw = () => {
      frame = 0
      if (disposed || !visible || document.hidden) return
      controls.update()
      renderer.render(scene, camera)
    }
    const requestDraw = () => {
      if (!disposed && !frame && visible && !document.hidden) {
        frame = requestAnimationFrame(draw)
      }
    }
    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (!width || !height) return
      const aspect = width / height
      const halfWidth = Math.max(2.8, 1.85 * aspect)
      camera.left = -halfWidth
      camera.right = halfWidth
      camera.top = halfWidth / aspect
      camera.bottom = -halfWidth / aspect
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      requestDraw()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (!visible && frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      if (visible) requestDraw()
    })
    intersection.observe(container)
    const visibility = () => {
      if (document.hidden && frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      if (!document.hidden) requestDraw()
    }
    document.addEventListener('visibilitychange', visibility)
    controls.addEventListener('change', requestDraw)
    controls.addEventListener('start', manualTurn)

    let lastProgress = -1
    let lastMantle = -1
    let lastView: ShellView | null = null
    update.current = (next, nextView) => {
      const shape = getShape(next.progress)
      if (next.progress !== lastProgress) {
        shell.geometry.dispose()
        shell.geometry = createShellGeometry(next.progress)
        inner.geometry.dispose()
        inner.geometry = createShellGeometry(next.progress, 'inner')
        const matrix = new Matrix4()
        const quaternion = new Quaternion()
        for (let i = 0; i < 26; i++) {
          for (let side = 0; side < 2; side++) {
            const point = shellPoint(
              0.1 + (i / 25) * 0.8,
              (side === 0 ? -1 : 1) * (Math.PI - shape.opening),
              next.progress,
              -0.012,
            )
            matrix.compose(
              new Vector3(point.x, point.y, point.z),
              quaternion,
              new Vector3(0.018, 0.025, 0.045 * Math.max(0.01, shape.teeth)),
            )
            teeth.setMatrixAt(i * 2 + side, matrix)
          }
        }
        teeth.instanceMatrix.needsUpdate = true
        teeth.visible = shape.teeth > 0
        coil.visible = shape.coilVisibility > 0
        coil.scale.setScalar(shape.scale)
        spireMaterial.opacity = shape.coilVisibility
        lip.visible = next.progress > 80
        growthRims.forEach((growthRim, i) => {
          growthRim.geometry.dispose()
          growthRim.visible = next.progress < 75
          if (!growthRim.visible) {
            growthRim.geometry = new BufferGeometry()
            return
          }
          const points = Array.from({ length: 73 }, (_, row) => {
            const point = shellPoint(
              row / 72,
              (i === 0 ? -1 : 1) * (Math.PI - shape.opening),
              next.progress,
              -0.008,
            )
            return new Vector3(point.x, point.y, point.z)
          })
          growthRim.geometry = new TubeGeometry(
            new CatmullRomCurve3(points),
            80,
            0.016 * shape.scale,
            6,
            false,
          )
        })
      }
      if (
        next.mantle > 0 &&
        (next.progress !== lastProgress || next.mantle !== lastMantle)
      ) {
        leftMantle.geometry.dispose()
        rightMantle.geometry.dispose()
        leftMantle.geometry = createShellGeometry(
          next.progress,
          'mantle-left',
          next.mantle,
        )
        rightMantle.geometry = createShellGeometry(
          next.progress,
          'mantle-right',
          next.mantle,
        )
      }
      leftMantle.visible = rightMantle.visible = next.mantle > 0
      foot.visible = next.mantle > 0
      tentacles.forEach((tentacle) => (tentacle.visible = next.mantle > 0))
      repair.visible = next.showRepair && next.progress === 100
      specimen.scale.setScalar(next.lengthMm / 110)
      specimen.position.y =
        shape.height * 1.32 * 0.66 * shape.scale * (next.lengthMm / 110) - 0.62
      shadow.scale.set(
        shape.scale * (next.lengthMm / 110),
        shape.scale * (next.lengthMm / 110),
        1,
      )
      if (nextView !== lastView && nextView !== 'free') {
        if (nextView === 'aperture') camera.position.set(0.5, -6, 1.1)
        else camera.position.set(1.2, 2.65, 5)
        camera.zoom = 1
        camera.updateProjectionMatrix()
        controls.target.set(0, 0, 0)
        controls.update()
      }
      lastProgress = next.progress
      lastMantle = next.mantle
      lastView = nextView
      requestDraw()
    }
    const keydown = (event: KeyboardEvent) => {
      if (
        event.target !== container ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return
      if (
        !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(
          event.key,
        )
      )
        return
      event.preventDefault()
      manualTurn()
      if (event.key === 'Home') {
        camera.position.set(1.2, 2.65, 5)
        camera.zoom = 1
      } else {
        const offset = camera.position.clone().sub(controls.target)
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          offset.applyAxisAngle(
            new Vector3(0, 1, 0),
            event.key === 'ArrowLeft' ? -0.16 : 0.16,
          )
        } else {
          const right = new Vector3()
            .crossVectors(offset, camera.up)
            .normalize()
          offset.applyAxisAngle(right, event.key === 'ArrowUp' ? 0.12 : -0.12)
        }
        camera.position.copy(controls.target).add(offset)
      }
      camera.updateProjectionMatrix()
      controls.update()
      requestDraw()
    }
    container.addEventListener('keydown', keydown)
    const contextLost = (event: Event) => {
      event.preventDefault()
      console.warn(
        'The 3D graphics context was lost. Switching to illustration.',
      )
      status.report(
        '3D was interrupted. Your place and the illustrated controls are preserved.',
      )
    }
    renderer.domElement.addEventListener('webglcontextlost', contextLost)
    initializeState()
    resize()

    return () => {
      disposed = true
      rememberedCamera.current = {
        position: camera.position.clone(),
        target: controls.target.clone(),
        zoom: camera.zoom,
      }
      update.current = null
      cancelAnimationFrame(frame)
      observer.disconnect()
      intersection.disconnect()
      document.removeEventListener('visibilitychange', visibility)
      container.removeEventListener('keydown', keydown)
      renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      controls.removeEventListener('change', requestDraw)
      controls.removeEventListener('start', manualTurn)
      controls.dispose()
      for (const mesh of [
        shell,
        inner,
        leftMantle,
        rightMantle,
        ...growthRims,
        lip,
        coil,
        foot,
        repair,
        ...tentacles,
        shadow,
      ]) {
        mesh.geometry.dispose()
      }
      teeth.dispose()
      teethGeometry.dispose()
      for (const material of [
        shellMaterial,
        lipMaterial,
        mantleMaterial,
        darkMaterial,
        spireMaterial,
        repairMaterial,
        growthRimMaterial,
        shadowMaterial,
      ]) {
        material.dispose()
      }
      map.dispose()
      shadowMap.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [reducedMotion, status, theme])

  useEffect(() => {
    update.current?.(state, view)
  }, [state, view])

  return (
    <div
      className={`shell-renderer${failure ? ' has-fallback' : ''}`}
      ref={host}
      tabIndex={0}
      role="group"
      aria-describedby="shell-summary"
      aria-label={
        failure
          ? 'Interactive shell illustration. Use the top and underside buttons below to change the view.'
          : 'Turn the shell with arrow keys. Home resets the view. Or use the top and underside buttons below.'
      }
    >
      {failure && (
        <>
          <ShellFallback state={state} aperture={view === 'aperture'} />
          <p className="render-notice" role="status">
            {failure}
          </p>
        </>
      )}
    </div>
  )
}
