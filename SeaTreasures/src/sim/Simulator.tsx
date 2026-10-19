import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode, RefObject } from 'react'
import { getClaim, manifest, sourcesFor } from '../evidence.ts'
import {
  CARD_MM,
  PX_PER_MM_RANGE,
  readCalibration,
  saveCalibration,
  scaleBar,
} from './calibration.ts'
import {
  clockAt,
  describeDuration,
  frameAt,
  phaseAt,
  phases,
  startOf,
} from './life.ts'
import type { PhaseId } from './life.ts'
import { addToShelf, parseShelf, shelfKey } from './shelf.ts'
import type { Found } from './shelf.ts'
import { allSpecies, getSpecies, speciesData } from './species.ts'
import type { Species } from './species.ts'
import type { Measure, Pulse, StageEvent } from './Stage.tsx'
import { looks } from './looks.ts'

const Stage = lazy(() => import('./Stage.tsx'))
const FieldPlates = lazy(() => import('./FieldPlates.tsx'))

type IconName =
  | 'play'
  | 'pause'
  | 'sun'
  | 'moon'
  | 'close'
  | 'reset'
  | 'cut'
  | 'xray'
  | 'ruler'
  | 'hand'
  | 'apart'

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    play: <path d="M8 5v14l11-7Z" />,
    pause: <path d="M8 5v14M16 5v14" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    moon: <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    reset: <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />,
    cut: <path d="M12 3v18M6 7a6 6 0 0 0 0 10M18 7a6 6 0 0 1 0 10" />,
    xray: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3.5" />
      </>
    ),
    ruler: <path d="M3 16 16 3l5 5L8 21Zm4-3 2 2m1-5 2 2m1-5 2 2" />,
    hand: (
      <path d="M8 13V5a1.5 1.5 0 0 1 3 0v6m0-1V4a1.5 1.5 0 0 1 3 0v6m0-1V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.5-4a1.5 1.5 0 0 1 2.5-1.6L8 15" />
    ),
    apart: <path d="M4 12h5m6 0h5M9 8l-3 4 3 4m6-8 3 4-3 4" />,
  }
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => setReduced(query.matches)
    query.addEventListener('change', changed)
    return () => query.removeEventListener('change', changed)
  }, [])
  return reduced
}

const scopeLabel: Record<string, string> = {
  subspecies: 'this subspecies',
  species: 'this species',
  family: 'its family',
  mollusks: 'molluscs generally',
  'other-cowries': 'other cowries',
  'demo-limitation': 'a limit of this demo',
}

/** One sourced statement with its evidence on demand. */
function Fact({ claim: id, children }: { claim: string; children: ReactNode }) {
  const claim = getClaim(id)
  return (
    <div className="fact" data-claim-id={claim.id}>
      <p>{children}</p>
      <details>
        <summary>
          Evidence · {scopeLabel[claim.scope] ?? claim.scope} ·{' '}
          {claim.confidence}
        </summary>
        <p>{claim.text}</p>
        <p className="fact-note">{claim.evidenceNote}</p>
        <ul>
          {sourcesFor(claim).map((source) => (
            <li key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.publisher}: {source.title}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function EvidenceLibrary({
  dialog,
}: {
  dialog: RefObject<HTMLDialogElement | null>
}) {
  return (
    <dialog
      ref={dialog}
      className="evidence-dialog"
      aria-labelledby="evidence-title"
    >
      <div className="dialog-heading">
        <h2 id="evidence-title">Sources and uncertainty</h2>
        <button
          className="icon-button"
          aria-label="Close sources"
          onClick={() => dialog.current?.close()}
        >
          <Icon name="close" />
        </button>
      </div>
      <p>
        Every fact in the simulator links to a source read for this project.
        Scope says whether it is about this species, its family, or molluscs in
        general. Shell shapes, animals and patterns are original illustrations
        from simple growth models, not scans.
      </p>
      {manifest.sources.map((source) => (
        <article className="source-entry" key={source.id}>
          <h3>{source.title}</h3>
          <a href={source.url} target="_blank" rel="noreferrer">
            {source.publisher} ↗
          </a>
          <p className="metadata">
            {source.kind} · accessed {source.accessedAt}
          </p>
          {manifest.claims
            .filter((claim) => claim.sourceIds.includes(source.id))
            .map((claim) => (
              <div className="source-claim" key={claim.id}>
                <p>{claim.text}</p>
                <p className="metadata">
                  {scopeLabel[claim.scope] ?? claim.scope} · {claim.confidence}{' '}
                  confidence
                </p>
              </div>
            ))}
        </article>
      ))}
    </dialog>
  )
}

function CalibrationDialog({
  dialog,
  pxPerMm,
  onSave,
}: {
  dialog: RefObject<HTMLDialogElement | null>
  pxPerMm: number
  onSave: (value: number) => void
}) {
  const [value, setValue] = useState(pxPerMm)
  return (
    <dialog
      ref={dialog}
      className="calibration-dialog"
      aria-labelledby="calibration-title"
      onClose={() => setValue(pxPerMm)}
    >
      <div className="dialog-heading">
        <h2 id="calibration-title">Match a real card</h2>
        <button
          className="icon-button"
          aria-label="Close calibration"
          onClick={() => dialog.current?.close()}
        >
          <Icon name="close" />
        </button>
      </div>
      <p>
        Hold any bank or ID card against the screen and drag until the outline
        matches its width. Screens differ, so this makes “actual size” true on
        yours.
      </p>
      <div
        className="card-outline"
        style={{ width: CARD_MM[0] * value, height: CARD_MM[1] * value }}
      >
        <span>85.6 × 54 mm</span>
      </div>
      <label className="control-label" htmlFor="calibration">
        Card width on screen
      </label>
      <input
        className="range"
        id="calibration"
        type="range"
        min={PX_PER_MM_RANGE[0]}
        max={PX_PER_MM_RANGE[1]}
        step="0.01"
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        aria-valuetext={`${Math.round(CARD_MM[0] * value)} pixels wide`}
      />
      <div className="dialog-actions">
        <button className="secondary" onClick={() => dialog.current?.close()}>
          Cancel
        </button>
        <button
          className="primary"
          onClick={() => {
            onSave(value)
            dialog.current?.close()
          }}
        >
          Use this size
        </button>
      </div>
    </dialog>
  )
}

const known = (speciesId: string, originId: string) =>
  allSpecies.some(
    (species) =>
      species.id === speciesId &&
      species.origins.some((origin) => origin.id === originId),
  )

function readShelf(): { shelf: Found[]; error: string | null } {
  try {
    return {
      shelf: parseShelf(localStorage.getItem(shelfKey), known),
      error: null,
    }
  } catch (error) {
    console.error('The shelf could not be read.', error)
    return {
      shelf: [],
      error:
        'Your shelf on this device could not be read. Nothing has been overwritten.',
    }
  }
}

function swatch(species: Species) {
  const pattern = looks[species.id]!.pattern
  const colour = 'ground' in pattern ? pattern.ground : [200, 200, 200]
  const accent =
    pattern.kind === 'spots'
      ? pattern.spot
      : pattern.kind === 'tents'
        ? pattern.light
        : pattern.kind === 'flames'
          ? pattern.flame
          : pattern.kind === 'blotches'
            ? pattern.blotch
            : pattern.margin
  return {
    '--swatch': `rgb(${colour.join(' ')})`,
    '--swatch-mark': `rgb(${accent.join(' ')})`,
  } as React.CSSProperties
}

/** The one thing to try in each part of the life: shown on the stage and as a button. */
function actionFor(
  phase: PhaseId,
  species: Species,
): { hint: string; button: string | null } {
  switch (phase) {
    case 'egg':
      return { hint: 'Tap the eggs to hatch them', button: 'Hatch them all' }
    case 'larva':
      return species.group === 'cephalopod'
        ? {
            hint: 'A small nautilus hatches already shelled',
            button: 'Let it settle',
          }
        : { hint: 'Move or tap to steer the larva', button: 'Let it settle' }
    case 'growth':
      return { hint: 'Press and hold the shell to grow it', button: 'Grow' }
    case 'adult':
      return {
        hint: 'Tap the animal: it pulls back into its shell',
        button: 'Poke it',
      }
    case 'death':
      return { hint: 'Choose how its life ends', button: null }
    case 'remains':
      return species.drifts
        ? {
            hint: 'Tap the shell: the empty chambers let it float',
            button: 'Let it drift',
          }
        : {
            hint: 'Tap the shell to call a hermit crab',
            button: 'Call a hermit crab',
          }
    case 'beach':
      return {
        hint: 'Tap the shell to let a wave roll it',
        button: 'Send a wave',
      }
    case 'found':
      return { hint: 'Tap the shell to pick it up', button: 'Pick it up' }
  }
}

function PhaseStory({
  species,
  phase,
  deathId,
  onDeath,
  originName,
  shelf,
  onRemove,
  shelfError,
}: {
  species: Species
  phase: PhaseId
  deathId: string
  onDeath: (id: string) => void
  originName: string
  shelf: Found[]
  onRemove: (index: number) => void
  shelfError: string | null
}) {
  const { life } = species
  const death =
    species.deaths.find((item) => item.id === deathId) ?? species.deaths[0]
  switch (phase) {
    case 'egg':
      return life.egg.claim ? (
        <Fact claim={life.egg.claim}>{life.egg.text}</Fact>
      ) : (
        <p>{life.egg.text}</p>
      )
    case 'larva':
      return (
        <>
          {life.larva.claim ? (
            <Fact claim={life.larva.claim}>{life.larva.text}</Fact>
          ) : (
            <p>{life.larva.text}</p>
          )}
          <Fact claim="mollusca-larvae">
            Most molluscs hatch as swimming larvae; some, like the nautilus,
            hatch as small versions of the adult.
          </Fact>
        </>
      )
    case 'growth':
      return (
        <>
          <Fact claim="shell-mantle-secretes">
            The mantle adds new shell only at the opening. The first, larval
            shell stays at the tip while every whorl after it is built around
            it.
          </Fact>
          {life.maturity.claim ? (
            <Fact claim={life.maturity.claim}>{life.maturity.text}</Fact>
          ) : (
            <p>{life.maturity.text}</p>
          )}
          <Fact claim="meinhardt-pattern-space-time-record">
            The pattern is laid down at the growing edge too, so the shell is a
            record of its own growth over time.
          </Fact>
          <p className="model-note">
            Growth between birth and adult size is drawn on an illustrative
            curve, not a measured rate.
          </p>
        </>
      )
    case 'adult':
      return (
        <>
          <Fact claim="mollusca-body-plan">
            Inside: a soft, muscular body. Its mantle builds the shell and holds
            a cavity for breathing; a rasping radula feeds it.
          </Fact>
          {life.lifespan.claim ? (
            <Fact claim={life.lifespan.claim}>{life.lifespan.text}</Fact>
          ) : (
            <p>{life.lifespan.text}</p>
          )}
          <Fact claim={species.pattern.claim}>
            {species.pattern.description}
          </Fact>
          <Fact claim={species.lengthMm.claim}>
            Adult size:{' '}
            {species.lengthMm.typical
              ? `${species.lengthMm.typical[0]}–${species.lengthMm.typical[1]} mm`
              : `up to ${species.lengthMm.max} mm`}
            . {species.drawnNote} Turn on “Actual size” to see it at true scale
            on your screen.
          </Fact>
        </>
      )
    case 'death':
      return (
        <>
          <fieldset className="choices">
            <legend>How does it end?</legend>
            {species.deaths.map((item) => (
              <label key={item.id}>
                <input
                  type="radio"
                  name="death"
                  value={item.id}
                  checked={death?.id === item.id}
                  onChange={() => onDeath(item.id)}
                />
                {item.cause}
              </label>
            ))}
          </fieldset>
          {death && <Fact claim={death.claim}>{death.cause}</Fact>}
        </>
      )
    case 'remains':
      return (
        <>
          {[
            ...species.remains,
            ...speciesData.shared.remains.filter(
              (item) =>
                !item.id.includes('wave') &&
                (species.group === 'gastropod' || !item.id.includes('hermit')),
            ),
          ]
            .slice(0, 4)
            .map((item) => (
              <Fact key={item.id} claim={item.claim}>
                {item.text}
              </Fact>
            ))}
        </>
      )
    case 'beach':
      return (
        <>
          {speciesData.shared.remains
            .filter(
              (item) =>
                !item.id.includes('hermit') && !item.id.includes('predator'),
            )
            .slice(0, 3)
            .map((item) => (
              <Fact key={item.id} claim={item.claim}>
                {item.text}
              </Fact>
            ))}
        </>
      )
    case 'found':
      return (
        <>
          {[...species.collecting, ...speciesData.shared.collecting].map(
            (item) => (
              <Fact key={item.id} claim={item.claim}>
                {item.text}
              </Fact>
            ),
          )}
          <div className="shelf">
            {shelfError && (
              <p className="notice error" role="alert">
                {shelfError}
              </p>
            )}
            {shelf.length > 0 && (
              <ol aria-label="Your shelf">
                {shelf.map((item, index) => {
                  const found = getSpecies(item.speciesId)
                  const origin = found.origins.find(
                    (entry) => entry.id === item.originId,
                  )
                  return (
                    <li key={`${item.foundAt}-${index}`}>
                      <span>
                        <strong>{found.commonName}</strong> ·{' '}
                        {origin?.name ?? originName}
                        <time dateTime={item.foundAt}>
                          {new Date(item.foundAt).toLocaleDateString()}
                        </time>
                      </span>
                      <button
                        className="text-button"
                        onClick={() => onRemove(index)}
                        aria-label={`Remove ${found.commonName} from your shelf`}
                      >
                        Remove
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </>
      )
  }
}

export function Simulator() {
  const [speciesId, setSpeciesId] = useState(() => {
    const requested = new URLSearchParams(location.search).get('species')
    return allSpecies.some((species) => species.id === requested)
      ? requested!
      : allSpecies[0]!.id
  })
  const species = getSpecies(speciesId)
  const [originId, setOriginId] = useState(species.origins[0]!.id)
  const origin =
    species.origins.find((item) => item.id === originId) ?? species.origins[0]!
  const [t, setT] = useState(startOf('adult') + 0.06)
  const [playing, setPlaying] = useState(false)
  const [deathId, setDeathId] = useState(species.deaths[0]?.id ?? '')
  const [cut, setCut] = useState(false)
  const [xray, setXray] = useState(false)
  const [actual, setActual] = useState(false)
  const [calibration, setCalibration] = useState(() =>
    readCalibration(localStorage),
  )
  const [measure, setMeasure] = useState<Measure>({
    pxPerMm: calibration.pxPerMm,
    magnified: false,
  })
  const [{ shelf, error: shelfReadError }, setShelfState] = useState(readShelf)
  const [shelfError, setShelfError] = useState<string | null>(shelfReadError)
  const [shelfDamaged] = useState(shelfReadError !== null)
  const [announcement, setAnnouncement] = useState('')
  const [apartChoice, setApart] = useState(0)
  const [pulse, setPulse] = useState<Pulse | null>(null)
  const [growing, setGrowing] = useState(false)
  const [crabCalled, setCrabCalled] = useState(false)
  const [floatCalled, setFloatCalled] = useState(false)
  const [waves, setWaves] = useState(0)
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme ?? 'light',
  )
  const reducedMotion = useReducedMotion()
  const [offline, setOffline] = useState<
    'local' | 'preparing' | 'ready' | 'unavailable'
  >(
    import.meta.env.PROD
      ? 'serviceWorker' in navigator
        ? 'preparing'
        : 'unavailable'
      : 'local',
  )

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    let active = true
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        if (active) setOffline('ready')
      })
      .catch((error: unknown) => {
        console.error('Offline setup did not complete.', error)
        if (active) setOffline('unavailable')
      })
    return () => {
      active = false
    }
  }, [])
  const sources = useRef<HTMLDialogElement>(null)
  const calibrate = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  const death =
    species.deaths.find((item) => item.id === deathId) ?? species.deaths[0]
  const base = useMemo(
    () => frameAt(t, species, death?.mark ?? 'none'),
    [t, species, death],
  )
  // Choices made in one part of the life only apply there; leaving it forgets them.
  const inRemains = base.phase === 'remains'
  const living = base.phase === 'adult' || base.phase === 'growth'
  const apart = living ? apartChoice : 0
  const frame = useMemo(
    () => ({
      ...base,
      hermit: inRemains && crabCalled && species.hermit ? 1 : base.hermit,
      drift: inRemains && floatCalled && species.drifts ? 1 : base.drift,
      wear: base.beach ? Math.min(0.9, base.wear + waves * 0.08) : base.wear,
    }),
    [base, inRemains, crabCalled, floatCalled, waves, species],
  )
  const action = actionFor(frame.phase, species)
  const { index: phaseIndex, phase } = phaseAt(t)
  const clock = clockAt(frame, species)
  const bar = scaleBar(measure.pxPerMm)

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    let id = 0
    const tick = (now: number) => {
      const step = (now - last) / 1000 / 45
      last = now
      setT((value) => {
        const next = Math.min(1, value + step)
        if (next >= 1) setPlaying(false)
        return next
      })
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [playing])

  useEffect(() => {
    if (!growing) return
    let last = performance.now()
    let id = 0
    const tick = (now: number) => {
      const step = (now - last) / 1000 / 14
      last = now
      setT((value) => {
        const stop = startOf('adult') + 0.02
        if (value >= stop) {
          setGrowing(false)
          return value
        }
        return Math.min(stop, Math.max(value, startOf('growth')) + step)
      })
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [growing])

  const [seenPhase, setSeenPhase] = useState(base.phase)
  if (seenPhase !== base.phase) {
    setSeenPhase(base.phase)
    if (base.phase !== 'remains') {
      setCrabCalled(false)
      setFloatCalled(false)
    }
    if (!base.beach) setWaves(0)
    if (!living) setApart(0)
  }

  const act = (kind: Pulse['kind']) => setPulse({ kind, at: performance.now() })

  function onStage(event: StageEvent) {
    switch (event.type) {
      case 'hatch':
        if (event.left === 0) {
          setAnnouncement('All hatched. The larvae swim off.')
          setT(startOf('larva') + 0.02)
        } else setAnnouncement(`${event.left} eggs left.`)
        break
      case 'settle':
        setAnnouncement('It settles and starts to build.')
        setT(startOf('growth') + 0.004)
        break
      case 'hold':
        setPlaying(false)
        setGrowing(event.on)
        break
      case 'poke':
        setAnnouncement(
          'It pulls back into its shell, then slowly comes out again.',
        )
        break
      case 'shell':
        if (species.drifts) {
          setFloatCalled(true)
          setAnnouncement(
            'The empty, gas-filled chambers float the shell away.',
          )
        } else if (species.hermit) {
          setCrabCalled(true)
          setAnnouncement('A hermit crab moves into the empty shell.')
        }
        break
      case 'tumble':
        setWaves((count) => count + 1)
        setAnnouncement('A wave rolls the shell. Sand and water wear it down.')
        break
      case 'pickup':
        writeShelf(
          addToShelf(shelf, { speciesId: species.id, originId: origin.id }),
          `${species.commonName} added to your shelf.`,
        )
        break
    }
  }

  function runAction() {
    switch (frame.phase) {
      case 'egg':
        return act('hatch')
      case 'larva':
        return act('settle')
      case 'growth':
        setPlaying(false)
        return setGrowing(!growing)
      case 'adult':
        return act('poke')
      case 'remains':
        return onStage({ type: 'shell' })
      case 'beach':
        return act('tumble')
      case 'found':
        return act('pickup')
      case 'death':
        return undefined
    }
  }

  function chooseSpecies(id: string) {
    const next = getSpecies(id)
    setSpeciesId(id)
    setOriginId(next.origins[0]!.id)
    setDeathId(next.deaths[0]?.id ?? '')
    setAnnouncement(`${next.commonName}, ${next.scientificName}.`)
    const url = new URL(location.href)
    url.searchParams.set('species', id)
    history.replaceState(null, '', url)
  }

  function writeShelf(next: Found[], message: string) {
    if (shelfDamaged) {
      setShelfError(
        'Remove nothing and reload: your shelf could not be read, so it will not be overwritten.',
      )
      return
    }
    try {
      localStorage.setItem(shelfKey, JSON.stringify(next))
      setShelfState({ shelf: next, error: null })
      setShelfError(null)
      setAnnouncement(message)
    } catch (error) {
      console.error('The shelf could not be saved.', error)
      setShelfError(
        'Saving to your shelf is unavailable on this device. Check browser storage and try again.',
      )
    }
  }

  const summary = `${species.commonName}, ${species.scientificName}, from ${origin.name}. ${phase.label}: ${clock.label}. ${
    frame.size > 0
      ? `Shell ${Math.round(species.lengthMm.drawn * frame.size * 10) / 10} millimetres long${actual ? ', shown at actual size' : ''}.`
      : 'No shell yet.'
  }${cut ? ' Cut open.' : ''}${xray ? ' X-ray view.' : ''}`

  return (
    <div className="sim" data-phase={frame.phase}>
      <a className="skip-link" href="#timeline">
        Skip to the life timeline
      </a>
      <header className="sim-top">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <img src={`${import.meta.env.BASE_URL}shell-mark.svg`} alt="" />
          <span>
            Sea
            <br />
            Treasures
          </span>
        </a>
        <div className="sim-title">
          <h1 ref={heading} tabIndex={-1}>
            {species.commonName}
          </h1>
          <div className="sim-taxon">
            <Fact claim={species.taxonClaim}>
              <i>{species.scientificName}</i> {species.authority}
            </Fact>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="text-button"
            onClick={() => sources.current?.showModal()}
          >
            Sources
          </button>
          <button
            className="icon-button"
            aria-label={
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </div>
      </header>

      <main className="sim-main" id="main">
        <nav className="species-picker" aria-label="Choose a shell">
          <h2 className="panel-label">Species</h2>
          <ul>
            {allSpecies.map((item) => (
              <li key={item.id}>
                <button
                  aria-pressed={item.id === species.id}
                  onClick={() => chooseSpecies(item.id)}
                  style={swatch(item)}
                >
                  <span className="swatch" aria-hidden="true" />
                  <span>
                    <strong>{item.commonName}</strong>
                    <i>{item.scientificName}</i>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <label className="panel-label" htmlFor="origin">
            Origin
          </label>
          <select
            id="origin"
            value={origin.id}
            onChange={(event) => setOriginId(event.target.value)}
          >
            {species.origins.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <Fact claim={origin.claim}>
            {origin.habitat}
            {origin.depthM &&
              ` · ${origin.depthM[0]}–${origin.depthM[1]} m deep`}
          </Fact>
          <div className="picker-note">
            <Fact claim="mollusca-diversity">
              Five of about 86,600 living mollusc species. Snails make up about
              80% of them.
            </Fact>
          </div>
        </nav>

        <section className="sim-view" aria-label="Shell">
          <Suspense
            fallback={
              <div className="sim-stage loading" role="status">
                Preparing the shell…
              </div>
            }
          >
            <Stage
              species={species}
              frame={frame}
              cut={cut}
              xray={xray}
              actual={actual}
              apart={apart}
              pxPerMm={calibration.pxPerMm}
              reducedMotion={reducedMotion}
              pulse={pulse}
              onMeasure={setMeasure}
              onEvent={onStage}
            />
          </Suspense>
          <div className="action-hint" aria-hidden="true">
            <Icon name="hand" />
            {action.hint}
          </div>
          <div className="view-badge" aria-live="polite">
            {actual
              ? calibration.calibrated
                ? 'Actual size'
                : 'Actual size · estimate'
              : measure.magnified
                ? 'Magnified'
                : 'Fitted to view'}
          </div>
          <div className="scale-bar" aria-hidden="true">
            <span style={{ width: bar.px }} />
            {bar.mm < 1 ? `${bar.mm * 1000} µm` : `${bar.mm} mm`}
          </div>
          <div className="view-controls" role="group" aria-label="View">
            <button
              aria-pressed={cut}
              onClick={() => setCut(!cut)}
              disabled={frame.size === 0}
            >
              <Icon name="cut" />
              Cut open
            </button>
            <button
              aria-pressed={xray}
              onClick={() => setXray(!xray)}
              disabled={frame.size === 0}
            >
              <Icon name="xray" />
              X-ray
            </button>
            <button aria-pressed={actual} onClick={() => setActual(!actual)}>
              <Icon name="ruler" />
              Actual size
            </button>
            {actual && (
              <button
                className="text-button"
                onClick={() => calibrate.current?.showModal()}
              >
                Calibrate
              </button>
            )}
          </div>
          {frame.animal > 0 && frame.larva === 0 && (
            <label className="take-apart">
              <Icon name="apart" />
              <span>Take apart</span>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(apart * 100)}
                onChange={(event) => setApart(Number(event.target.value) / 100)}
                aria-valuetext={
                  apart > 0.05
                    ? `Body pulled ${Math.round(apart * 100)}% out of the shell`
                    : 'Body inside the shell'
                }
              />
            </label>
          )}
          <p className="sr-only" id="sim-summary">
            {summary}
          </p>
        </section>

        <aside className="life-panel" aria-labelledby="phase-title">
          <p className="panel-label">
            {String(phaseIndex + 1).padStart(2, '0')} /{' '}
            {String(phases.length).padStart(2, '0')}
          </p>
          <h2 id="phase-title">{phase.label}</h2>
          <p className={`clock${clock.known ? '' : ' unknown'}`}>
            {clock.label}
          </p>
          {action.button && (
            <button
              className="primary action-button"
              onClick={runAction}
              aria-pressed={frame.phase === 'growth' ? growing : undefined}
            >
              <Icon name="hand" />
              {frame.phase === 'growth' && growing
                ? 'Stop growing'
                : action.button}
            </button>
          )}
          <div className="phase-story">
            <PhaseStory
              species={species}
              phase={frame.phase}
              deathId={death?.id ?? ''}
              onDeath={setDeathId}
              originName={origin.name}
              shelf={shelf}
              shelfError={shelfError}
              onRemove={(index) =>
                writeShelf(
                  shelf.filter((_, at) => at !== index),
                  'Removed from your shelf.',
                )
              }
            />
          </div>
          <dl className="durations">
            <div>
              <dt>Egg</dt>
              <dd>{describeDuration(species.life.egg)}</dd>
            </div>
            <div>
              <dt>Larva</dt>
              <dd>{describeDuration(species.life.larva)}</dd>
            </div>
            <div>
              <dt>To adult</dt>
              <dd>{describeDuration(species.life.maturity)}</dd>
            </div>
            <div>
              <dt>Lifespan</dt>
              <dd>{describeDuration(species.life.lifespan)}</dd>
            </div>
            <div>
              <dt>Adult size</dt>
              <dd>
                {species.lengthMm.typical
                  ? `${species.lengthMm.typical[0]}–${species.lengthMm.typical[1]} mm`
                  : 'Not established'}
                {species.lengthMm.max
                  ? ` · up to ${species.lengthMm.max} mm`
                  : ''}
              </dd>
            </div>
            <div>
              <dt>Drawn at</dt>
              <dd title={species.drawnNote}>{species.lengthMm.drawn} mm</dd>
            </div>
          </dl>
        </aside>
      </main>

      <section className="timeline" id="timeline" aria-label="Life timeline">
        <button
          className="play"
          onClick={() => {
            if (t >= 1) setT(0)
            setPlaying(!playing)
          }}
          aria-label={playing ? 'Pause the life' : 'Play the life'}
        >
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <div className="track">
          <input
            className="range"
            type="range"
            min="0"
            max="1000"
            step="1"
            value={Math.round(t * 1000)}
            onChange={(event) => {
              setPlaying(false)
              setT(Number(event.target.value) / 1000)
            }}
            aria-label="Life timeline"
            aria-valuetext={`${phase.label}. ${clock.label}`}
          />
          <ol className="phase-ticks">
            {phases.map((item, index) => (
              <li key={item.id} style={{ flexGrow: item.share }}>
                <button
                  aria-current={index === phaseIndex ? 'step' : undefined}
                  onClick={() => {
                    setPlaying(false)
                    setT(startOf(item.id) + item.share * 0.5)
                  }}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {species.id === 'tiger-cowrie' && (
        <details className="field-plates">
          <summary>Field plates: inside the tiger cowrie</summary>
          <Suspense fallback={<p role="status">Preparing the plates…</p>}>
            <FieldPlates reducedMotion={reducedMotion} />
          </Suspense>
        </details>
      )}

      <footer className="footer">
        <span>SeaTreasures · an open-source experiment by Andreas Kleiner</span>
        <span role="status">
          {offline === 'ready'
            ? 'Offline ready'
            : offline === 'preparing'
              ? 'Preparing offline copy'
              : offline === 'local'
                ? 'Local preview'
                : 'Offline copy unavailable'}
        </span>
        <span>
          No account. No upload. Shells and animals are original illustrations.
        </span>
      </footer>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <EvidenceLibrary dialog={sources} />
      <CalibrationDialog
        dialog={calibrate}
        pxPerMm={calibration.pxPerMm}
        onSave={(value) => {
          try {
            saveCalibration(localStorage, value)
            setCalibration({ pxPerMm: value, calibrated: true, error: null })
            setAnnouncement('Actual size calibrated for this screen.')
          } catch (error) {
            console.error('Calibration could not be saved.', error)
            setCalibration({
              pxPerMm: value,
              calibrated: true,
              error:
                'Calibration applies now but could not be saved on this device.',
            })
          }
        }}
      />
      {calibration.error && (
        <p className="notice error toast" role="alert">
          {calibration.error}
        </p>
      )}
    </div>
  )
}
