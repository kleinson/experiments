import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ACESFilmicToneMapping,
  AmbientLight,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshPhysicalMaterial,
  OrthographicCamera,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { paramInfo, presets, shellSurface } from './morphospace.ts'
import type { Preset, ShellParams } from './morphospace.ts'

/** Growth bands along the shell: each stripe is a former edge of the opening. */
function growthTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 64
  const context = canvas.getContext('2d')!
  const gradient = context.createLinearGradient(0, 0, 512, 0)
  gradient.addColorStop(0, '#f1e3cd')
  gradient.addColorStop(1, '#e8cfae')
  context.fillStyle = gradient
  context.fillRect(0, 0, 512, 64)
  for (let x = 0; x < 512; x += 3) {
    const shade = 0.06 + 0.12 * Math.abs(Math.sin(x * 0.11))
    context.fillStyle = `rgba(120, 80, 50, ${shade})`
    context.fillRect(x, 0, 1, 64)
  }
  for (let x = 20; x < 512; x += 46 + Math.floor((x * 7) % 30)) {
    context.fillStyle = 'rgba(150, 82, 46, 0.45)'
    context.fillRect(x, 0, 6, 64)
  }
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  map.wrapS = map.wrapT = RepeatWrapping
  return map
}

function Viewer({
  params,
  preset,
  reducedMotion,
}: {
  params: ShellParams
  preset: Preset
  reducedMotion: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<{ set: (p: ShellParams, valves: number) => void } | null>(
    null,
  )

  useEffect(() => {
    const container = host.current
    if (!container) return
    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      container.dataset.failed = ''
      return
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.domElement.setAttribute('aria-hidden', 'true')
    container.prepend(renderer.domElement)
    const scene = new Scene()
    scene.add(
      new HemisphereLight(0xffffff, 0x8a7f74, 1.6),
      new AmbientLight(0xffffff, 0.4),
    )
    const key = new DirectionalLight(0xffffff, 2.6)
    key.position.set(-120, 220, 160)
    scene.add(key)
    const camera = new OrthographicCamera(-70, 70, 70, -70, -1000, 1000)
    camera.position.set(140, 90, 220)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.autoRotate = !reducedMotion
    controls.autoRotateSpeed = 1.2
    controls.addEventListener('start', () => (controls.autoRotate = false))
    const map = growthTexture()
    const outer = new MeshPhysicalMaterial({
      map,
      roughness: 0.4,
      clearcoat: 0.35,
      side: DoubleSide,
    })
    const inner = new MeshPhysicalMaterial({
      color: new Color(0.94, 0.84, 0.78),
      roughness: 0.25,
      side: DoubleSide,
    })
    let shell: Group | null = null
    const set = (p: ShellParams, valves: number) => {
      if (shell) {
        scene.remove(shell)
        shell.traverse((object) => (object as Mesh).geometry?.dispose())
      }
      shell = new Group()
      const { geometry } = shellSurface(
        p,
        100,
        0.9,
        valves === 2 ? Math.max(0, p.turns - 0.5) : 0,
      )
      map.repeat.set(Math.max(1, p.turns * 2), 1)
      const front = new Mesh(geometry, outer)
      shell.add(front)
      const lining = new Mesh(geometry.clone(), inner)
      lining.scale.setScalar(0.985)
      shell.add(lining)
      if (valves === 2) {
        // A bivalve: the model draws one valve; its partner is the mirror image across the plane
        // where the two meet, opened a little at the hinge so you can see inside.
        geometry.computeBoundingBox()
        const box = geometry.boundingBox!
        const hingeY = box.max.y
        const valve = new Group()
        valve.add(front, lining)
        const partner = new Group()
        const mirrored = new Mesh(geometry.clone(), outer)
        mirrored.scale.z = -1
        const mirroredLining = new Mesh(geometry.clone(), inner)
        mirroredLining.scale.set(0.985, 0.985, -0.985)
        partner.add(mirrored, mirroredLining)
        for (const part of [valve, partner]) {
          part.position.y = -hingeY
        }
        const top = new Group()
        top.add(valve)
        top.position.y = hingeY
        top.rotation.x = -0.28
        const bottom = new Group()
        bottom.add(partner)
        bottom.position.y = hingeY
        bottom.rotation.x = 0.28
        shell.remove(front, lining)
        shell.add(top, bottom)
        shell.rotation.set(0.2, 0.6, 0)
      }
      scene.add(shell)
    }
    const fit = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (!width || !height) return
      renderer.setSize(width, height)
      const half = 68
      camera.left = (-half * width) / height
      camera.right = (half * width) / height
      camera.top = half
      camera.bottom = -half
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(fit)
    observer.observe(container)
    let frame = 0
    let visible = true
    const sight = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting)
    })
    sight.observe(container)
    const loop = () => {
      frame = requestAnimationFrame(loop)
      if (!visible || document.hidden) return
      controls.update()
      renderer.render(scene, camera)
    }
    loop()
    api.current = { set }
    return () => {
      cancelAnimationFrame(frame)
      api.current = null
      observer.disconnect()
      sight.disconnect()
      controls.dispose()
      if (shell)
        shell.traverse((object) => (object as Mesh).geometry?.dispose())
      outer.dispose()
      inner.dispose()
      map.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [reducedMotion])

  useEffect(() => {
    api.current?.set(params, preset.valves ?? 1)
  }, [params, preset, reducedMotion])

  return (
    <div
      className="lab-view"
      ref={host}
      role="img"
      aria-label={`A generated ${preset.name.toLowerCase()} shell. Drag to turn it.`}
    />
  )
}

/**
 * The shell lab: explore how six numbers make every shell, from the published
 * parameters of real species to shapes that never existed.
 */
export default function ShellLab({
  reducedMotion,
}: {
  reducedMotion: boolean
}) {
  const [presetId, setPresetId] = useState(presets[0]!.id)
  const preset = presets.find((item) => item.id === presetId)!
  const [params, setParams] = useState<ShellParams>(preset.params)
  const changed = useMemo(
    () =>
      (Object.keys(params) as (keyof ShellParams)[]).some(
        (key) => params[key] !== preset.params[key],
      ),
    [params, preset],
  )
  const groups = [...new Set(presets.map((item) => item.group))]

  return (
    <section className="lab" aria-labelledby="lab-title">
      <header className="lab-head">
        <div>
          <p className="panel-label">Shell lab</p>
          <h2 id="lab-title">Six numbers make a shell</h2>
        </div>
        <p>
          Nearly every coiled shell is one tube that widens as it turns. A model
          by Contreras-Figueroa and Aragón (2023) captures snails, limpets,
          nautiluses, ammonites and clams with six numbers. Start from a real
          species and change them, or make a shell that never lived.
        </p>
      </header>
      <div className="lab-body">
        <div
          className="lab-presets"
          role="group"
          aria-label="Start from a species"
        >
          {groups.map((group) => (
            <div key={group}>
              <h3>{group}</h3>
              {presets
                .filter((item) => item.group === group)
                .map((item) => (
                  <button
                    key={item.id}
                    aria-pressed={item.id === presetId}
                    onClick={() => {
                      setPresetId(item.id)
                      setParams(item.params)
                    }}
                  >
                    <strong>{item.name}</strong>
                    <i>{item.scientificName}</i>
                  </button>
                ))}
            </div>
          ))}
        </div>
        <Viewer params={params} preset={preset} reducedMotion={reducedMotion} />
        <div className="lab-controls">
          {paramInfo.map((info) => (
            <div key={info.key} className="lab-slider">
              <span className="lab-slider-head">
                <label htmlFor={`lab-${info.key}`}>{info.label}</label>
                <output htmlFor={`lab-${info.key}`}>
                  {params[info.key].toFixed(
                    info.step < 0.01 ? 3 : info.step < 1 ? 2 : 0,
                  )}
                </output>
              </span>
              <input
                id={`lab-${info.key}`}
                type="range"
                min={info.min}
                max={info.max}
                step={info.step}
                value={Math.min(info.max, Math.max(info.min, params[info.key]))}
                onChange={(event) =>
                  setParams({
                    ...params,
                    [info.key]: Number(event.target.value),
                  })
                }
                aria-describedby={`lab-help-${info.key}`}
              />
              <span className="lab-help" id={`lab-help-${info.key}`}>
                {info.help}
              </span>
            </div>
          ))}
          <button
            className="text-button"
            onClick={() => setParams(preset.params)}
            disabled={!changed}
          >
            Reset to {preset.name.toLowerCase()}
          </button>
        </div>
      </div>
      <p className="model-note">
        {changed
          ? 'Your own shell: a shape the model allows. It may or may not exist in nature.'
          : preset.fromPaper
            ? `Shape parameters for ${preset.scientificName} as published in Table 1 of the paper.`
            : `${preset.name}: tuned for this lab, not taken from the paper.`}{' '}
        Model: Contreras-Figueroa & Aragón (2023),{' '}
        <a
          href="https://doi.org/10.3390/d15030431"
          target="_blank"
          rel="noreferrer"
        >
          Diversity 15(3), 431
        </a>{' '}
        (CC BY 4.0), written for SeaTreasures from its equations. Inspired by{' '}
        <a
          href="https://github.com/ludi317/mollusc3d"
          target="_blank"
          rel="noreferrer"
        >
          mollusc3d
        </a>
        . Colour is illustrative.
      </p>
    </section>
  )
}
