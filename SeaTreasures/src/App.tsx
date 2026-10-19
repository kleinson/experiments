import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import {
  collectionKey,
  createSavedSpecimen,
  describeSize,
  experience,
  getShellSummary,
  getStage,
  moments,
  parseSavedSpecimen,
} from './model.ts'
import type { Moment, SavedSpecimen, ShellState } from './model.ts'
import { getClaim, manifest, sourcesFor } from './evidence.ts'
import { ShellFallback } from './ShellFallback.tsx'
import type { ShellView } from './ShellFigure.tsx'

const ShellFigure = lazy(() => import('./ShellFigure.tsx'))
const AnatomyPlates = lazy(() => import('./anatomy/AnatomyPlates.tsx'))

function Icon({
  name,
}: {
  name: 'arrow' | 'back' | 'sun' | 'moon' | 'close' | 'check' | 'top' | 'bottom'
}) {
  const paths: Record<typeof name, ReactNode> = {
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    back: <path d="M20 12H4m6-6-6 6 6 6" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    moon: <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    top: <ellipse cx="12" cy="12" rx="8" ry="5" />,
    bottom: (
      <>
        <ellipse cx="12" cy="12" rx="8" ry="5" />
        <path d="M6 12h12" />
      </>
    ),
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

function readCollection(): {
  specimen: SavedSpecimen | null
  error: string | null
} {
  try {
    const raw = localStorage.getItem(collectionKey)
    return { specimen: raw ? parseSavedSpecimen(raw) : null, error: null }
  } catch (error) {
    console.error('The local specimen could not be read.', error)
    return {
      specimen: null,
      error:
        'Your saved specimen could not be read. Nothing has been overwritten. You can still explore, or remove the unreadable local save below.',
    }
  }
}

function ClaimView({
  id,
  label,
  copy,
}: {
  id: string
  label?: string
  copy?: string
}) {
  const claim = getClaim(id)
  return (
    <div className="claim" data-claim-id={claim.id}>
      {label && <p className="claim-label">{label}</p>}
      <p>{copy ?? claim.text}</p>
      <details>
        <summary>Evidence &amp; uncertainty</summary>
        {copy && <p>{claim.text}</p>}
        <p className="scope">
          {claim.scope.replaceAll('-', ' ')} · {claim.confidence} confidence
        </p>
        <p>{claim.evidenceNote}</p>
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
  dialog: React.RefObject<HTMLDialogElement | null>
}) {
  return (
    <dialog
      ref={dialog}
      className="evidence-dialog"
      aria-labelledby="evidence-title"
    >
      <div className="dialog-heading">
        <h2 id="evidence-title">A story with sources.</h2>
        <button
          className="icon-button"
          aria-label="Close evidence library"
          onClick={() => dialog.current?.close()}
        >
          <Icon name="close" />
        </button>
      </div>
      <p>
        These references travel with the demo. Opening an original source needs
        a connection. General cowrie biology is not presented as a study of this
        Hawaiian subspecies. Confidence describes the evidence, not a photo
        match.
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
          {source.accessNote && <p>{source.accessNote}</p>}
          {manifest.claims
            .filter((claim) => claim.sourceIds.includes(source.id))
            .map((claim) => (
              <div className="source-claim" key={claim.id}>
                <p>{claim.text}</p>
                <p>
                  {claim.scope.replaceAll('-', ' ')} · {claim.confidence}{' '}
                  confidence
                </p>
                <p>{claim.evidenceNote}</p>
              </div>
            ))}
        </article>
      ))}
      {manifest.claims
        .filter((claim) => claim.sourceIds.length === 0)
        .map((claim) => (
          <article className="source-entry" key={claim.id}>
            <h3>Demo limitation</h3>
            <p>{claim.text}</p>
            <p>{claim.evidenceNote}</p>
          </article>
        ))}
    </dialog>
  )
}

const introductions: Record<
  Moment,
  { eyebrow: string; title: string; copy: string }
> = {
  discover: {
    eyebrow: 'A pocket natural-history museum',
    title: 'A life, left behind.',
    copy: 'Not just something you found. Something an animal made. Turn this shell over. There is a whole life inside its shape.',
  },
  identify: {
    eyebrow: '01 / Meet the specimen',
    title: 'A name is only the beginning.',
    copy: 'Meet our Hawaiian tiger cowrie. A carefully selected demo, with a story to explore—not an identification made by a camera.',
  },
  builder: {
    eyebrow: '02 / Who built this?',
    title: 'There was a builder.',
    copy: 'The empty object is only half the story. Bring its living tissue back into view.',
  },
  growth: {
    eyebrow: '03 / How did it grow?',
    title: 'A shape, not a clock.',
    copy: 'Move through an illustrated life. Watch the opening change. Then ask what a measurement can—and cannot—tell you.',
  },
  meaning: {
    eyebrow: '04 / What remains?',
    title: 'More than an empty shell.',
    copy: 'A place in an ecosystem. A material history. And a reminder that not every question has an exact answer.',
  },
}

const nextLabels: Record<Moment, string> = {
  discover: 'Open demo specimen',
  identify: 'Meet the living builder',
  builder: 'Explore its growth',
  growth: 'Read the rest of its story',
  meaning: 'Save to my collection',
}

export function App() {
  const [initialCollection] = useState(readCollection)
  const [moment, setMoment] = useState<Moment>('discover')
  const [view, setView] = useState<ShellView>('dorsal')
  const [progress, setProgress] = useState(0)
  const [lengthMm, setLengthMm] = useState(
    initialCollection.specimen?.lengthMm ?? experience.specimen.defaultLengthMm,
  )
  const [mantle, setMantle] = useState(55)
  const [showRepair, setShowRepair] = useState(false)
  const [note, setNote] = useState(initialCollection.specimen?.note ?? '')
  const [saved, setSaved] = useState<SavedSpecimen | null>(
    initialCollection.specimen,
  )
  const [collectionStatus, setCollectionStatus] = useState('')
  const [storageError, setStorageError] = useState<string | null>(
    initialCollection.error,
  )
  const [damagedSave, setDamagedSave] = useState(
    initialCollection.error !== null,
  )
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme ?? 'light',
  )
  const [manualTheme, setManualTheme] = useState(() => {
    const param = new URLSearchParams(location.search).get('scoutTheme')
    return param === 'dark' || param === 'light'
  })
  const [offline, setOffline] = useState<
    'local' | 'preparing' | 'ready' | 'unavailable'
  >(
    import.meta.env.PROD
      ? 'serviceWorker' in navigator
        ? 'preparing'
        : 'unavailable'
      : 'local',
  )
  const heading = useRef<HTMLHeadingElement>(null)
  const evidenceDialog = useRef<HTMLDialogElement>(null)
  const previousMoment = useRef(moment)
  const reducedMotion = useReducedMotion()
  const index = moments.findIndex((entry) => entry.id === moment)
  const intro = introductions[moment]
  const stage = getStage(progress)
  const size = describeSize(lengthMm)
  const shell: ShellState = {
    progress: moment === 'growth' ? progress : 100,
    lengthMm,
    mantle: moment === 'builder' ? mantle : 0,
    showRepair: moment === 'meaning' && showRepair,
  }

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue('--cp-bg')
      .trim()
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', color)
  }, [theme])

  useEffect(() => {
    const system = matchMedia('(prefers-color-scheme: dark)')
    const changed = () => {
      if (!manualTheme) setTheme(system.matches ? 'dark' : 'light')
    }
    system.addEventListener('change', changed)
    return () => system.removeEventListener('change', changed)
  }, [manualTheme])

  useLayoutEffect(() => {
    if (previousMoment.current === moment) return
    previousMoment.current = moment
    heading.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [moment])

  useEffect(() => {
    if (!import.meta.env.PROD) return
    if (!('serviceWorker' in navigator)) return
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

  function goTo(next: Moment) {
    setMoment(next)
    setView(next === 'growth' ? 'aperture' : 'dorsal')
  }

  function saveSpecimen() {
    if (damagedSave) {
      setStorageError(
        'Remove the unreadable local save before replacing it. It has not been overwritten.',
      )
      return
    }
    try {
      const specimen = createSavedSpecimen(lengthMm, note)
      localStorage.setItem(collectionKey, JSON.stringify(specimen))
      setSaved(specimen)
      setStorageError(null)
      setCollectionStatus('Specimen saved on this device.')
    } catch (error) {
      console.error('The specimen could not be saved.', error)
      setStorageError(
        'Saving is unavailable on this device. Your exploration still works; check browser storage permissions and try again.',
      )
    }
  }

  function removeSpecimen() {
    if (
      !window.confirm(
        'Remove the saved specimen and its note from this device?',
      )
    )
      return
    try {
      localStorage.removeItem(collectionKey)
      setSaved(null)
      setNote('')
      setDamagedSave(false)
      setStorageError(null)
      setCollectionStatus('Local specimen removed.')
    } catch (error) {
      console.error('The local specimen could not be removed.', error)
      setStorageError(
        'The saved specimen could not be removed. Check browser storage permissions and try again.',
      )
    }
  }

  function advance() {
    if (moment === 'meaning') saveSpecimen()
    else goTo(moments[index + 1].id)
  }

  return (
    <div className="app">
      <a className="skip-link" href="#story">
        Skip to the shell story
      </a>
      <header className="topbar">
        <button
          className="brand"
          onClick={() => goTo('discover')}
          aria-label="SeaTreasures, return to discovery"
        >
          <img src={`${import.meta.env.BASE_URL}shell-mark.svg`} alt="" />
          <span>
            Sea
            <br />
            Treasures
          </span>
        </button>
        <div className="header-actions">
          <span className="edition">FIELD NOTES / 001</span>
          <button
            className="icon-button"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            onClick={() => {
              setManualTheme(true)
              setTheme(theme === 'light' ? 'dark' : 'light')
            }}
          >
            <Icon name={theme === 'light' ? 'moon' : 'sun'} />
          </button>
        </div>
      </header>
      <nav className="journey-nav" aria-label="The specimen story">
        <ol>
          {moments.map((entry, i) => (
            <li key={entry.id}>
              <button
                aria-current={entry.id === moment ? 'step' : undefined}
                onClick={() => goTo(entry.id)}
              >
                <span className="step-number" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {entry.label}
              </button>
            </li>
          ))}
        </ol>
        <span className="journey-count" aria-hidden="true">
          {String(index + 1).padStart(2, '0')} / 05
        </span>
      </nav>
      <main id="story">
        <section
          className={`journey moment-${moment}`}
          aria-labelledby="moment-heading"
        >
          <div className="intro">
            <p className="eyebrow">{intro.eyebrow}</p>
            <h1 id="moment-heading" ref={heading} tabIndex={-1}>
              {intro.title}
            </h1>
            <p className="intro-copy">{intro.copy}</p>
          </div>
          <div className="interaction">
            <figure
              className="specimen"
              aria-label="Interactive Hawaiian tiger cowrie"
              aria-describedby="specimen-description shell-summary"
            >
              <div className="specimen-index">
                <span>Specimen 001 / Hawaiian tiger cowrie</span>
                <span className="live-indicator">
                  {moment === 'builder'
                    ? 'Living tissue'
                    : moment === 'growth'
                      ? stage.label
                      : 'Demo specimen'}
                </span>
              </div>
              <div className="figure-body">
                <Suspense
                  fallback={
                    <div className="model-loading">
                      <ShellFallback state={shell} />
                      <p role="status">Preparing the dimensional model…</p>
                    </div>
                  }
                >
                  <ShellFigure
                    state={shell}
                    view={view}
                    reducedMotion={reducedMotion}
                    theme={theme}
                    onManualTurn={() => setView('free')}
                  />
                </Suspense>
              </div>
              <div className="specimen-controls">
                <div
                  className="segmented"
                  role="group"
                  aria-label="Specimen view"
                >
                  <button
                    aria-pressed={view === 'dorsal'}
                    onClick={() => setView('dorsal')}
                  >
                    <Icon name="top" />
                    Top
                  </button>
                  <button
                    aria-pressed={view === 'aperture'}
                    onClick={() => setView('aperture')}
                  >
                    <Icon name="bottom" />
                    Underside
                  </button>
                </div>
              </div>
              {moment === 'meaning' && (
                <label className="figure-repair" htmlFor="repair">
                  Inspect an illustrated repair
                  <input
                    id="repair"
                    type="checkbox"
                    checked={showRepair}
                    onChange={(event) => setShowRepair(event.target.checked)}
                  />
                </label>
              )}
              <figcaption
                className="specimen-caption"
                id="specimen-description"
              >
                <strong className="drag-hint">
                  Drag to turn. Arrow keys when focused.
                </strong>
                <strong className="fallback-hint">
                  Use Top and Underside to inspect the illustration.
                </strong>
                <br />
                Original illustration · not a scan or exact anatomical
                reconstruction
                {moment === 'meaning' && (
                  <>
                    <br />
                    The repair mark is hypothetical, not an observed injury.
                  </>
                )}
              </figcaption>
              <p className="sr-only" id="shell-summary">
                {getShellSummary(shell)}
              </p>
            </figure>
            <div className="story">
              {moment === 'discover' && (
                <>
                  <span className="demo-tag">
                    No camera. No upload. Just curiosity.
                  </span>
                  <p className="lede">
                    One specimen. Five small discoveries. Start with the object,
                    then meet the life that made it.
                  </p>
                  <div className="field-note">
                    <p>
                      A guided demo, not an identification service. The shell
                      and living tissue are original illustrations.
                    </p>
                  </div>
                </>
              )}
              {moment === 'identify' && (
                <>
                  <div>
                    <h2 className="specimen-name">
                      {experience.specimen.commonName}
                    </h2>
                    <p className="latin-name">
                      {experience.specimen.scientificName}
                    </p>
                  </div>
                  <span className="demo-tag">
                    Selected specimen · no identification score
                  </span>
                  <ClaimView
                    id="taxonomy-accepted-subspecies"
                    label="A taxonomic starting point"
                    copy="Recognized by MolluscaBase as a subspecies of the tiger cowrie. The name is a starting point, not a photo match."
                  />
                  <ClaimView
                    id="distribution-hawaii-type-locality"
                    label="Where does this story begin?"
                    copy="The documented type locality is Hawaii. Provenance matters when distinguishing the Hawaiian form from its wider-ranging parent species."
                  />
                  <div className="field-note">
                    <p>
                      Spots alone are not a subspecies test. This illustration
                      does not establish identity, locality, or authenticity for
                      a shell you own.
                    </p>
                  </div>
                  <div>
                    <p className="eyebrow">
                      Look-alikes / not a diagnostic key
                    </p>
                    <div className="lookalikes">
                      <div className="lookalike">
                        <ShellFallback state={{ ...shell, lengthMm: 110 }} />
                        <h3>Tiger cowrie</h3>
                        <p>
                          <i>Cypraea tigris</i>
                        </p>
                      </div>
                      <div className="lookalike">
                        <ShellFallback
                          state={{ ...shell, progress: 90, lengthMm: 110 }}
                        />
                        <h3>Panther cowrie</h3>
                        <p>
                          <i>Cypraea pantherina</i>
                        </p>
                      </div>
                    </div>
                    <p className="range-caption">
                      Schematic comparison only; not species-specific
                      photographs.
                    </p>
                    <ClaimView
                      id="lookalike-pantherina-identity"
                      label="A similar-looking alternative"
                      copy="The panther cowrie is a separate, similar-looking species. Neither this illustration nor spots alone can settle a real-world identification."
                    />
                  </div>
                </>
              )}
              {moment === 'builder' && (
                <>
                  <div>
                    <div className="control-header">
                      <label htmlFor="mantle">
                        Let the mantle cover the shell
                      </label>
                      <output htmlFor="mantle">{mantle}%</output>
                    </div>
                    <input
                      className="range"
                      id="mantle"
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={mantle}
                      onChange={(event) =>
                        setMantle(Number(event.target.value))
                      }
                      aria-describedby="mantle-note"
                    />
                    <p className="range-caption" id="mantle-note">
                      Highlighted tissue wraps from both sides. Rose is an
                      explanatory highlight, not the animal’s natural color.
                    </p>
                  </div>
                  <ClaimView
                    id="mantle-coating-and-polish"
                    label="Why is it so glossy?"
                    copy="The cowrie’s mantle can wrap over the outside of its shell. Living tissue covers and maintains the surface—not just the animal inside it."
                  />
                  <ClaimView
                    id="material-shell-secretion"
                    label="Built by living tissue"
                    copy="A mollusk’s mantle secretes proteins and minerals to build its shell. The illustrated rim marks a building edge, not the speed of construction."
                  />
                  <ClaimView
                    id="function-protective-shell"
                    label="What is the shell for?"
                  />
                </>
              )}
              {moment === 'growth' && (
                <>
                  <div>
                    <div className="control-header">
                      <label htmlFor="growth">Move through growth stages</label>
                      <output htmlFor="growth">{stage.label}</output>
                    </div>
                    <input
                      className="range"
                      id="growth"
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={progress}
                      onChange={(event) =>
                        setProgress(Number(event.target.value))
                      }
                      aria-valuetext={`${stage.label}, conceptual growth stage; not elapsed time`}
                      aria-describedby="growth-note"
                    />
                    <div
                      className="stage-pills"
                      role="group"
                      aria-label="Choose a growth stage"
                    >
                      {experience.stages.map((item) => (
                        <button
                          key={item.id}
                          aria-pressed={stage.id === item.id}
                          onClick={() =>
                            setProgress(
                              item.id === 'mature' ? 100 : item.startsAt,
                            )
                          }
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <p className="range-caption" id="growth-note">
                      Stage position, not time. Rose rims highlight the
                      conceptual shell-building edge. Shape changes and relative
                      scale are illustrative—not measured growth rates.
                    </p>
                    <div className="stage-readout" aria-live="polite">
                      <h2>{stage.caption}</h2>
                      <p>{stage.description}</p>
                    </div>
                  </div>
                  <div className="clock-note">
                    <strong>How old? We can’t tell you that.</strong>
                    <p>
                      {experience.ageNotice} Maturity is not chronological age;
                      no lifespan is estimated here.
                    </p>
                  </div>
                  <div className="measurement">
                    <div className="control-header">
                      <label htmlFor="length">Adult reference length</label>
                      <output htmlFor="length">{lengthMm} mm</output>
                    </div>
                    <input
                      className="range"
                      id="length"
                      type="range"
                      min={experience.measurement.minMm}
                      max={experience.measurement.maxMm}
                      step={experience.measurement.stepMm}
                      value={lengthMm}
                      onChange={(event) =>
                        setLengthMm(Number(event.target.value))
                      }
                      aria-describedby="length-note"
                    />
                    <p className="range-caption" id="length-note">
                      {experience.specimen.measurementNotice} The selected
                      length scales the adult reference independently of stage.
                    </p>
                    <div
                      className="comparison"
                      role="group"
                      aria-label="Compare example lengths"
                    >
                      {experience.measurement.comparisonLengthsMm.map(
                        (length) => (
                          <button
                            key={length}
                            aria-pressed={lengthMm === length}
                            onClick={() => setLengthMm(length)}
                          >
                            {length} mm
                          </button>
                        ),
                      )}
                    </div>
                    <p className="range-caption">
                      {experience.measurement.comparisonNotice}
                    </p>
                    <div className="size-readout" aria-live="polite">
                      <h2>{size.title}</h2>
                      <p>{size.detail}</p>
                    </div>
                    <p className="range-caption">
                      {experience.sizeGuide.notice}
                    </p>
                    <ClaimView
                      id="size-reference-schilderiana"
                      label="Where these comparisons come from"
                      copy="One specialist guide reports about 100 mm as an adult average, about 153 mm as a maximum, and calls specimens over roughly 125 mm rare. These are field-reference figures, not a population survey."
                    />
                  </div>
                  <ClaimView
                    id="juvenile-to-adult-shape-change"
                    label="What the model represents"
                    copy="Young cowries have an open, visibly coiled form. As the lip thickens inward, the familiar rounded adult shape emerges."
                  />
                  <ClaimView
                    id="demo-no-length-to-age-model"
                    label="What remains unknown"
                  />
                </>
              )}
              {moment === 'meaning' && (
                <>
                  <ClaimView
                    id="ecology-habitat-reef"
                    label="Where did it belong?"
                    copy="Tiger cowries live around coral-reef structures, sheltering in crevices and among coral heads. This is species-level ecology, not a separate Hawaiian subspecies study."
                  />
                  <ClaimView
                    id="ecology-nocturnal-foraging"
                    label="After the light fades"
                    copy="The living tiger cowrie is generally more active at night, emerging from daytime shelter to forage."
                  />
                  <ClaimView
                    id="ecology-diet"
                    label="A place in the food web"
                    copy="Tiger cowries are reported to graze and scavenge, eating algae and reef animals. These specialist accounts are limited evidence—not a measured diet study of this Hawaiian subspecies."
                  />
                  <ClaimView
                    id="currency-other-cowries-not-tiger-cowrie"
                    label="Was this money?"
                    copy="Some cowries traveled the world as currency—especially money and ring cowries. That history should not be assigned to this much larger tiger cowrie."
                  />
                  {showRepair && (
                    <div className="field-note">
                      <p>
                        This is a hypothetical mark, not evidence of an injury
                        to a real animal. Abrasion, predation, and repair cannot
                        be diagnosed from our illustration.
                      </p>
                    </div>
                  )}
                  <ClaimView
                    id="repair-shell-damage"
                    label="Reading a mark cautiously"
                    copy="Living mollusks can repair some shell damage. That is demonstrated in mussel experiments—not a timetable for this cowrie, or a diagnosis of our illustrated mark."
                  />
                  <div className="field-note">
                    <p>
                      <strong>Leave living shells where they belong.</strong>{' '}
                      Observe without taking animals. Check local collection
                      rules; this demo is not a collecting permit.
                    </p>
                  </div>
                  <div className="collection">
                    <h2>Keep the story, not the animal.</h2>
                    <p className="range-caption">
                      {experience.collectionNotice}
                    </p>
                    <label htmlFor="specimen-note">
                      Your field note{' '}
                      <span className="range-caption">(optional)</span>
                    </label>
                    <textarea
                      id="specimen-note"
                      value={note}
                      maxLength={280}
                      placeholder="What would you like to remember?"
                      onChange={(event) => {
                        setNote(event.target.value)
                        setCollectionStatus('')
                      }}
                      aria-describedby="note-limit"
                    />
                    <div className="collection-meta" id="note-limit">
                      <span>Demo specimen · {lengthMm} mm reference</span>
                      <span>{note.length}/280</span>
                    </div>
                    {saved && (
                      <div className="collection-receipt">
                        <Icon name="check" />
                        <div>
                          <p>
                            <strong>One story in your collection.</strong>
                          </p>
                          <p>
                            Demo reference: {saved.lengthMm} mm · age unknown
                          </p>
                          <p>
                            Saved{' '}
                            {new Date(saved.savedAt).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                            . This is a save date, not a collection date.
                          </p>
                        </div>
                      </div>
                    )}
                    {(saved || damagedSave) && (
                      <button className="text-button" onClick={removeSpecimen}>
                        {damagedSave
                          ? 'Remove unreadable local save'
                          : 'Remove saved specimen'}
                      </button>
                    )}
                    <p className="sr-only" role="status">
                      {collectionStatus}
                    </p>
                  </div>
                </>
              )}
              {storageError && (
                <div className="notice error" role="alert">
                  {storageError}
                  {moment !== 'meaning' && (
                    <button
                      className="text-button"
                      onClick={() => goTo('meaning')}
                    >
                      Manage local collection
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
        {(moment === 'builder' || moment === 'growth') && (
          <Suspense
            fallback={
              <p className="an-loading" role="status">
                Preparing the anatomy plates…
              </p>
            }
          >
            <AnatomyPlates
              moment={moment}
              progress={progress}
              lengthMm={lengthMm}
              mantle={mantle}
              reducedMotion={reducedMotion}
              onProgress={setProgress}
            />
          </Suspense>
        )}
        <div className="journey-actions">
          <button
            className="secondary"
            disabled={index === 0}
            onClick={() => {
              if (index > 0) goTo(moments[index - 1].id)
            }}
          >
            <Icon name="back" />
            Back
          </button>
          <p className="action-note">
            {moment === 'meaning'
              ? 'A demo saved locally. Nothing uploaded.'
              : 'A little closer to the life behind the object.'}
          </p>
          <button className="primary" onClick={advance}>
            {moment === 'meaning' && saved
              ? 'Update saved specimen'
              : nextLabels[moment]}
            <Icon name={moment === 'meaning' ? 'check' : 'arrow'} />
          </button>
        </div>
      </main>
      <footer className="footer">
        <div className="footer-left">
          <span>An experiment by Andreas Kleiner</span>
          <button
            className="text-button"
            onClick={() => evidenceDialog.current?.showModal()}
          >
            Sources &amp; uncertainty
          </button>
        </div>
        <div className="footer-right">
          <span
            className={`offline-status${offline === 'ready' ? ' is-ready' : ''}`}
            role="status"
          >
            {offline === 'ready'
              ? 'Offline ready'
              : offline === 'preparing'
                ? 'Preparing offline copy'
                : offline === 'unavailable'
                  ? 'Offline copy unavailable'
                  : 'Local preview'}
          </span>
          <span>No account. No upload.</span>
        </div>
      </footer>
      <EvidenceLibrary dialog={evidenceDialog} />
    </div>
  )
}
