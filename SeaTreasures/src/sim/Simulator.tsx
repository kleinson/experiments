import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
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
import {
  BookOpen,
  ChevronDown,
  Hand,
  Layers,
  MapPin,
  Maximize,
  Moon,
  Pause,
  Play,
  Rotate3d,
  RotateCcw,
  Ruler,
  ScanEye,
  Scissors,
  Sun,
  Tag,
  Waves,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Toggle } from '@/components/ui/toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { termFor } from './glossary.ts'
import {
  bedLabels,
  beds,
  coastLabels,
  seabedFor,
  settingLabel,
} from './seabed.ts'
import type { Bed, Setting } from './seabed.ts'
import { activity } from './crawl.ts'
import type { Mode } from './crawl.ts'
import { drawThumbs } from './thumbs.ts'
import { localForm } from './forms.ts'
import { formatDepth } from './depth.ts'
import { reefLabels } from './places.ts'
import type { Thumbs } from './thumbs.ts'
import type { PhaseId } from './life.ts'
import { addToShelf, parseShelf, shelfKey } from './shelf.ts'
import type { Found } from './shelf.ts'
import { allSpecies, getSpecies, speciesData } from './species.ts'
import type { Species } from './species.ts'
import type { Measure, Pulse, StageEvent } from './Stage.tsx'
import { looks } from './looks.ts'
import {
  originsFor,
  placesWithShells,
  ranges,
  regionFor,
  shellsAt,
} from './ranges.ts'
import { WhereFound } from './WhereFound.tsx'

const Stage = lazy(() => import('./Stage.tsx'))
const FieldPlates = lazy(() => import('./FieldPlates.tsx'))
const ShellLab = lazy(() => import('../lab/ShellLab.tsx'))

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
  place: 'this place',
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
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="evidence-dialog flex max-h-[86dvh] flex-col gap-3 sm:max-w-2xl"
      >
        <DialogHeader className="flex-row items-start justify-between gap-4">
          <div className="grid gap-1">
            <DialogTitle className="text-xl font-normal tracking-tight">
              Sources and uncertainty
            </DialogTitle>
            <DialogDescription>
              Every fact in the simulator links to a source read for this
              project. Scope says whether it is about this species, its family,
              or molluscs in general. Shell shapes, animals, scenery and
              patterns are original illustrations from simple models, not scans.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close sources">
              <X />
            </Button>
          </DialogClose>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 pr-3">
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
                      {scopeLabel[claim.scope] ?? claim.scope} ·{' '}
                      {claim.confidence} confidence
                    </p>
                  </div>
                ))}
            </article>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function CalibrationDialog({
  open,
  onOpenChange,
  pxPerMm,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pxPerMm: number
  onSave: (value: number) => void
}) {
  const [value, setValue] = useState(pxPerMm)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setValue(pxPerMm)
        onOpenChange(next)
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-xl">
        <DialogHeader className="flex-row items-start justify-between gap-4">
          <div className="grid gap-1">
            <DialogTitle className="text-xl font-normal tracking-tight">
              Match a real card
            </DialogTitle>
            <DialogDescription>
              Hold any bank or ID card against the screen and drag until the
              outline matches its width. Screens differ, so this makes “actual
              size” true on yours.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close calibration">
              <X />
            </Button>
          </DialogClose>
        </DialogHeader>
        <div
          className="card-outline"
          style={{ width: CARD_MM[0] * value, height: CARD_MM[1] * value }}
        >
          <span>85.6 × 54 mm</span>
        </div>
        <Label htmlFor="calibration">Card width on screen</Label>
        <input
          className="w-full accent-(--cp-accent)"
          id="calibration"
          type="range"
          min={PX_PER_MM_RANGE[0]}
          max={PX_PER_MM_RANGE[1]}
          step="0.01"
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          aria-valuetext={`${Math.round(CARD_MM[0] * value)} pixels wide`}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            className="bg-brand text-brand-foreground hover:bg-brand/85"
            onClick={() => {
              onSave(value)
              onOpenChange(false)
            }}
          >
            Use this size
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Shelf entries name a recorded region, or an origin id from before regions were counted. */
const known = (speciesId: string, originId: string) =>
  allSpecies.some(
    (species) =>
      species.id === speciesId &&
      (originsFor(species.id).some((place) => place.region.id === originId) ||
        species.origins.some((origin) => origin.id === originId)),
  )

const placeName = (species: Species, originId: string) =>
  regionFor(originId)?.name ??
  species.origins.find((origin) => origin.id === originId)?.name ??
  originId

const firstOrigin = (species: Species) =>
  originsFor(species.id)[0]?.region.id ?? species.origins[0]!.id

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

const moveWords: Record<Mode, string> = {
  crawl: 'Crawling',
  vault: 'Vaulting',
  swim: 'Swimming',
  hover: 'Resting in the water',
  hidden: 'Hiding',
  buried: 'Buried',
  still: 'Swimming larva',
}

/** How the animal moves at this stage, by day or night, from its sources. */
function HowItMoves({
  species,
  phase,
  night,
  onNight,
}: {
  species: Species
  phase: PhaseId
  night: boolean
  onNight: () => void
}) {
  const now = activity(species, phase, night)
  if (!now.facts.length) return null
  return (
    <section className="how-it-moves grid gap-2" aria-label="How it moves">
      <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
        How it moves · {moveWords[now.mode]}
        {now.daily ? (night ? ' at night' : ' by day') : ''}
      </p>
      {now.facts.map((fact) => (
        <Fact key={fact.claim + fact.text} claim={fact.claim}>
          {fact.text}
        </Fact>
      ))}
      {now.wakesAtNight && !night && (
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start rounded-full"
          onClick={onNight}
        >
          <Moon />
          Watch it at night
        </Button>
      )}
    </section>
  )
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
                  return (
                    <li key={`${item.foundAt}-${index}`}>
                      <span>
                        <strong>{found.commonName}</strong> ·{' '}
                        {placeName(found, item.originId) || originName}
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

/** What the setting chip says about where the seabed came from. */
function settingNote(setting: Setting, choice: Bed | null) {
  if (setting.scene === 'open-water')
    return ' · the larva drifts in the plankton'
  if (setting.scene === 'beach') return ' · washed ashore'
  if (choice)
    return setting.elsewhere
      ? ' · your pick; not where this species lives'
      : ' · your pick'
  return setting.coast === 'reef'
    ? ' · from its habitat'
    : ` · from its habitat, with this coast's ${coastLabels[setting.coast]}`
}

const PANEL =
  'pointer-events-auto rounded-2xl border-0 bg-card/95 shadow-[0_0_0_1px_var(--cp-border),0_12px_32px_color-mix(in_srgb,var(--cp-text)_12%,transparent)] backdrop-blur-md'

/** What each animal does at night, where sourced. */
const nightNote: Record<string, { text: string; claim: string }> = {
  'tiger-cowrie': {
    text: 'At night tiger cowries come out of hiding to forage.',
    claim: 'ecology-nocturnal-foraging',
  },
  'textile-cone': {
    text: 'Buried in sand by day, it emerges to feed at night.',
    claim: 'depth-textile-cone',
  },
  'money-cowrie': {
    text: 'Money cowries graze in broad daylight, unlike nocturnal cowries.',
    claim: 'money-cowrie-habitat-behavior',
  },
}

const speciesIds = allSpecies.map((item) => item.id)
/** Every place where any of the shells has been recorded. */
const everyPlace = placesWithShells(speciesIds)

const groupLabel: Record<string, string> = {
  gastropod: 'Sea snail',
  cephalopod: 'Cephalopod',
}

type Here = ReturnType<typeof shellsAt>[number]

const levelWords: Record<string, string> = {
  often: 'often recorded',
  recorded: 'recorded',
  isolated: 'isolated records',
}

/** One shell in the menu: a studio picture of the shell, its underside and the living animal. */
function ShellCard({
  item,
  thumbs,
  chosen,
  here,
  bestAt,
  onChoose,
}: {
  item: Species
  thumbs?: Thumbs
  chosen: boolean
  here: Here | null
  bestAt: string
  onChoose: () => void
}) {
  return (
    <Button
      variant="outline"
      aria-pressed={chosen}
      onClick={onChoose}
      style={swatch(item)}
      className={cn(
        'h-auto w-full flex-col items-stretch gap-1 overflow-hidden rounded-xl p-0 text-left whitespace-normal',
        chosen && 'border-brand ring-1 ring-brand',
        !here && 'opacity-80',
      )}
    >
      <span
        className="shell-studio relative grid h-36 place-items-center"
        aria-hidden="true"
      >
        {thumbs ? (
          <>
            <img
              src={thumbs.shell}
              alt=""
              className="h-full w-full object-contain py-2 pr-14 pl-2"
            />
            <span className="absolute top-1.5 right-1.5 bottom-1.5 flex flex-col justify-center gap-1.5">
              <img src={thumbs.underside} alt="" className="shell-inset" />
              <img src={thumbs.animal} alt="" className="shell-inset" />
            </span>
          </>
        ) : (
          <span className="swatch size-14" />
        )}
      </span>
      <span className="grid gap-0.5 px-3 pt-1 pb-3">
        <strong className="text-sm font-semibold">{item.commonName}</strong>
        <i className="text-xs font-normal text-muted-foreground">
          {item.scientificName}
        </i>
        <span className="mt-1 font-mono text-[11px] font-normal text-muted-foreground">
          {here
            ? `${here.count.n} record${here.count.n === 1 ? '' : 's'} here · ${levelWords[here.level] ?? ''}${here.outside ? ' · outside its documented range' : ''}`
            : `Not recorded here · best at ${bestAt}`}
        </span>
        <span className="font-mono text-[11px] font-normal text-muted-foreground">
          {groupLabel[item.group] ?? item.group} · about {item.lengthMm.drawn}{' '}
          mm
        </span>
      </span>
    </Button>
  )
}

/** The floating shell menu: the shells found at this place first, then the rest. */
function ShellMenu({
  species,
  placeName: place,
  here,
  thumbs,
  onChoose,
  onOpen,
}: {
  species: Species
  placeName: string
  here: Here[]
  thumbs: Record<string, Thumbs>
  onChoose: (id: string) => void
  onOpen: () => void
}) {
  const [open, setOpen] = useState(false)
  const current = thumbs[species.id]
  const local = here.map((item) => item.speciesId)
  const elsewhere = allSpecies.filter((item) => !local.includes(item.id))
  const pick = (id: string) => {
    onChoose(id)
    setOpen(false)
  }
  const regionOf = (id: string) => {
    const best = originsFor(id)[0]
    return best?.region.name ?? ''
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) onOpen()
        setOpen(next)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 gap-2 rounded-full pr-3 pl-1 font-semibold"
          aria-label="Shells"
          style={swatch(species)}
        >
          {current ? (
            <img
              src={current.shell}
              alt=""
              className="h-8 w-11 object-contain"
            />
          ) : (
            <span className="swatch size-8" aria-hidden="true" />
          )}
          <span aria-hidden="true">Shells</span>
          <span
            className="rounded-full bg-muted px-1.5 font-mono text-[10px] font-normal"
            aria-hidden="true"
          >
            {local.length}
          </span>
          <ChevronDown aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        aria-label="Choose a shell"
        id="shell-tray"
        className="w-[min(680px,calc(100vw-2rem))] gap-3 rounded-2xl bg-[var(--cp-surface)] p-3 shadow-xl"
      >
        <div className="grid gap-0.5">
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            Found at {place}
          </p>
          <p className="text-xs text-muted-foreground">
            {local.length} of these {allSpecies.length} shells have been
            recorded here (GBIF specimens and observations). Pick another place
            to see what turns up there.
          </p>
        </div>
        <div className="-mr-1 max-h-[min(64dvh,600px)] overflow-y-auto overscroll-contain pr-1">
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-2">
            {here.map((item) => {
              const shown = localForm(
                getSpecies(item.speciesId),
                item.region.id,
              ).species
              return (
                <li key={item.speciesId}>
                  <ShellCard
                    item={shown}
                    thumbs={thumbs[item.speciesId]}
                    chosen={item.speciesId === species.id}
                    here={item}
                    bestAt=""
                    onChoose={() => pick(item.speciesId)}
                  />
                </li>
              )
            })}
          </ul>
          {elsewhere.length > 0 && (
            <>
              <p className="mt-4 mb-2 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                Not recorded at {place}
              </p>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-2">
                {elsewhere.map((item) => (
                  <li key={item.id}>
                    <ShellCard
                      item={item}
                      thumbs={thumbs[item.id]}
                      chosen={item.id === species.id}
                      here={null}
                      bestAt={regionOf(item.id)}
                      onChoose={() => pick(item.id)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <Separator />
        <div className="text-xs text-muted-foreground">
          <Fact claim="mollusca-diversity">
            Five of about 86,600 living mollusc species. Snails make up about
            80% of them.
          </Fact>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function Simulator() {
  const [speciesId, setSpeciesId] = useState(() => {
    const requested = new URLSearchParams(location.search).get('species')
    return allSpecies.some((species) => species.id === requested)
      ? requested!
      : allSpecies[0]!.id
  })
  const baseSpecies = getSpecies(speciesId)
  const [originId, setOriginId] = useState(() => {
    const requested = new URLSearchParams(location.search).get('place')
    return requested &&
      originsFor(baseSpecies.id).some((place) => place.region.id === requested)
      ? requested
      : firstOrigin(baseSpecies)
  })
  const origins = originsFor(baseSpecies.id)
  const origin = {
    id: origins.some((place) => place.region.id === originId)
      ? originId
      : firstOrigin(baseSpecies),
    name: placeName(baseSpecies, originId),
  }
  // The species as found here: its local form where the sources describe one.
  const form = useMemo(
    () => localForm(baseSpecies, origin.id),
    [baseSpecies, origin.id],
  )
  const species = form.species
  const shellsHere = useMemo(() => shellsAt(origin.id, speciesIds), [origin.id])
  const habitat =
    species.origins.find((item) => item.id === origin.id) ?? species.origins[0]!
  const [bedChoice, setBedChoice] = useState<Bed | null>(null)
  const [depthChoice, setDepthChoice] = useState<number | null>(null)
  const [thumbs, setThumbs] = useState<Record<string, Thumbs>>({})
  // The menu's drawings are made the first time it opens, so they never slow the first view.
  const [menuOpened, setMenuOpened] = useState(false)
  useEffect(
    () =>
      menuOpened
        ? drawThumbs(allSpecies, (id, pictures) =>
            setThumbs((all) => ({ ...all, [id]: pictures })),
          )
        : undefined,
    [menuOpened],
  )
  const [t, setT] = useState(startOf('adult') + 0.06)
  const [playing, setPlaying] = useState(false)
  const [deathId, setDeathId] = useState(species.deaths[0]?.id ?? '')
  const [cut, setCut] = useState(false)
  const [xray, setXray] = useState(false)
  const [labels, setLabels] = useState(true)
  // Opens on the realistic sea; the slider turns it into an educational drawing.
  const [look, setLook] = useState(1)
  const [turntable, setTurntable] = useState(false)
  const [part, setPart] = useState<string | null>(null)
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
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [calibrateOpen, setCalibrateOpen] = useState(false)
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
  const night = theme === 'dark'
  const term = part ? termFor(part, species.id) : undefined
  const setting = useMemo(
    () => seabedFor(species, origin.id, frame.phase, bedChoice, depthChoice),
    [species, origin.id, frame.phase, bedChoice, depthChoice],
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

  /** Picks a shell. It stays at this place if it was recorded here; otherwise it moves to its best place. */
  function chooseSpecies(id: string, placeId = origin.id) {
    const next = getSpecies(id)
    const stays = originsFor(id).some((place) => place.region.id === placeId)
    const place = stays ? placeId : firstOrigin(next)
    const shown = localForm(next, place).species
    setDepthChoice(null)
    setSpeciesId(id)
    setOriginId(place)
    setDeathId(next.deaths[0]?.id ?? '')
    setAnnouncement(
      `${shown.commonName}, ${shown.scientificName}${stays ? '' : `, at ${placeName(next, place)}`}.`,
    )
    remember(id, place)
  }

  /** Picks a place. If this shell was never recorded there, the best-recorded shell there takes over. */
  function choosePlace(placeId: string) {
    setDepthChoice(null)
    if (originsFor(speciesId).some((place) => place.region.id === placeId)) {
      setOriginId(placeId)
      setAnnouncement(`Place: ${placeName(baseSpecies, placeId)}.`)
      remember(speciesId, placeId)
      return
    }
    const best = shellsAt(placeId, speciesIds)[0]
    if (best) chooseSpecies(best.speciesId, placeId)
  }

  function remember(id: string, placeId: string) {
    const url = new URL(location.href)
    url.searchParams.set('species', id)
    url.searchParams.set('place', placeId)
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
  }${cut ? ' Cut open.' : ''}${xray ? ' See-through view.' : ''}`

  return (
    <div className="sim" data-phase={frame.phase}>
      <a className="skip-link" href="#timeline">
        Skip to the life timeline
      </a>
      <main className="sim-main" id="main">
        <section
          className="sim-view ocean"
          aria-label="Ocean floor"
          data-scene={setting.scene}
          data-bed={setting.main ?? 'open-water'}
        >
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
              setting={setting}
              labels={labels}
              look={look}
              turntable={turntable}
              selected={part}
              card={
                labels && term && part ? (
                  <Card
                    className="part-card w-[min(340px,calc(100vw-2rem))] gap-2 rounded-2xl border-0 bg-card/97 py-3 shadow-[0_0_0_1px_var(--cp-border),0_16px_40px_color-mix(in_srgb,var(--cp-text)_18%,transparent)] backdrop-blur-md"
                    role="region"
                    aria-label={part}
                  >
                    <CardHeader className="grid-cols-[1fr_auto] items-start gap-0.5 px-4">
                      <div className="grid gap-0.5">
                        <h3 className="font-mono text-xs font-semibold tracking-[0.12em] uppercase">
                          {part}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {term.what}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Close ${part}`}
                        onClick={() => setPart(null)}
                      >
                        <X />
                      </Button>
                    </CardHeader>
                    <CardContent className="grid gap-2.5 px-4">
                      <div className="grid gap-1">
                        <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                          What it’s for
                        </p>
                        <Fact claim={term.claim}>{term.use}</Fact>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPulse({
                              kind: 'focus',
                              part,
                              at: performance.now(),
                            })
                          }
                        >
                          <ZoomIn />
                          Zoom to {part.toLowerCase()}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => act('reset')}
                        >
                          <Maximize />
                          Show whole
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null
              }
              onPart={(text) => setPart(part === text ? null : text)}
              onMeasure={setMeasure}
              onEvent={onStage}
            />
          </Suspense>
          <div className="action-hint" aria-hidden="true">
            <Hand aria-hidden="true" />
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

          <div className="float-left">
            <Card className="float-title pointer-events-auto rounded-2xl border-0 bg-card/95 shadow-[0_0_0_1px_var(--cp-border),0_12px_32px_color-mix(in_srgb,var(--cp-text)_12%,transparent)] backdrop-blur-md gap-3 py-3.5">
              <CardHeader className="px-4">
                <div className="title-row">
                  <a className="brand" href={import.meta.env.BASE_URL}>
                    <img
                      src={`${import.meta.env.BASE_URL}shell-mark.svg`}
                      alt=""
                    />
                    <span className="sr-only">SeaTreasures</span>
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
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ShellMenu
                    species={species}
                    placeName={origin.name}
                    here={shellsHere}
                    thumbs={thumbs}
                    onChoose={(id) => chooseSpecies(id)}
                    onOpen={() => setMenuOpened(true)}
                  />
                  <Select value={origin.id} onValueChange={choosePlace}>
                    <SelectTrigger
                      id="origin"
                      aria-label="Place"
                      data-value={origin.id}
                      className="h-10 max-w-[16rem] rounded-full bg-background pl-3"
                    >
                      <MapPin className="text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[60dvh]">
                      {Object.entries(ranges.oceans).map(([ocean, label]) => {
                        const here = everyPlace.filter(
                          (place) => place.region.ocean === ocean,
                        )
                        return here.length ? (
                          <SelectGroup key={ocean}>
                            <SelectLabel>{label}</SelectLabel>
                            {here.map((place) => (
                              <SelectItem
                                key={place.region.id}
                                value={place.region.id}
                              >
                                {place.region.name}
                                <span className="text-muted-foreground">
                                  {place.shells.length} shell
                                  {place.shells.length === 1 ? '' : 's'}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ) : null
                      })}
                    </SelectContent>
                  </Select>
                  <Select
                    value={bedChoice ?? 'habitat'}
                    onValueChange={(value) =>
                      setBedChoice(value === 'habitat' ? null : (value as Bed))
                    }
                  >
                    <SelectTrigger
                      id="seabed"
                      aria-label="Seabed"
                      data-value={bedChoice ?? 'habitat'}
                      className="h-10 rounded-full bg-background pl-3"
                    >
                      <Waves className="text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="habitat">Its habitat</SelectItem>
                      <SelectSeparator />
                      {beds.map((bed) => (
                        <SelectItem key={bed} value={bed}>
                          {bedLabels[bed]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="setting-note" aria-live="polite">
                  <Fact claim="seabed-setting-illustrative">
                    <strong>{settingLabel(setting)}</strong>
                    {settingNote(setting, bedChoice)}
                  </Fact>
                  {setting.scene === 'seabed' && (
                    <Fact claim={setting.place.claim}>
                      <strong>{reefLabels[setting.place.reef]}</strong> ·{' '}
                      {setting.place.note}
                    </Fact>
                  )}
                  <Fact claim={habitat.claim}>
                    {habitat.habitat}
                    {habitat.depthM &&
                      ` · ${habitat.depthM[0]}–${habitat.depthM[1]} m deep`}
                  </Fact>
                  <Button
                    asChild
                    variant="link"
                    className="where-link h-auto justify-self-start p-0 text-xs text-muted-foreground"
                  >
                    <a href="#where">See it on the map</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <div
              className="float view-controls pointer-events-auto rounded-2xl border-0 bg-card/95 shadow-[0_0_0_1px_var(--cp-border),0_12px_32px_color-mix(in_srgb,var(--cp-text)_12%,transparent)] backdrop-blur-md flex flex-wrap gap-1 p-1"
              role="group"
              aria-label="View"
            >
              <Toggle
                size="lg"
                pressed={cut}
                onPressedChange={setCut}
                disabled={frame.size === 0}
                className="tool-toggle rounded-xl data-[state=on]:bg-foreground data-[state=on]:text-background"
              >
                <Scissors />
                Cut open
              </Toggle>
              <Toggle
                size="lg"
                pressed={xray}
                onPressedChange={setXray}
                disabled={frame.size === 0}
                className="tool-toggle rounded-xl data-[state=on]:bg-foreground data-[state=on]:text-background"
              >
                <ScanEye />
                See-through
              </Toggle>
              <Toggle
                size="lg"
                pressed={labels}
                onPressedChange={setLabels}
                className="tool-toggle rounded-xl data-[state=on]:bg-foreground data-[state=on]:text-background"
              >
                <Tag />
                Labels
              </Toggle>
              <Toggle
                size="lg"
                pressed={actual}
                onPressedChange={setActual}
                className="tool-toggle rounded-xl data-[state=on]:bg-foreground data-[state=on]:text-background"
              >
                <Ruler />
                Actual size
              </Toggle>
              {actual && (
                <Button
                  variant="link"
                  size="lg"
                  onClick={() => setCalibrateOpen(true)}
                >
                  Calibrate
                </Button>
              )}
            </div>
            {setting.scene !== 'beach' && (
              <Card
                className={`float depth-card ${PANEL} gap-1.5 px-4 py-3`}
                role="group"
                aria-label="Depth"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                    Depth{night ? ' · night dive' : ''}
                  </span>
                  <span className="depth-value font-mono text-sm">
                    ≈ {formatDepth(setting.depthM)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] whitespace-nowrap text-muted-foreground">
                    {formatDepth(setting.depth.reach[0])}
                  </span>
                  <Slider
                    min={setting.depth.reach[0]}
                    max={setting.depth.reach[1]}
                    step={setting.depth.reach[1] > 100 ? 10 : 0.5}
                    value={[setting.depthM]}
                    onValueChange={([value]) => setDepthChoice(value ?? null)}
                    thumbProps={{
                      'aria-label': 'Depth',
                      'aria-valuetext': `About ${formatDepth(setting.depthM)} deep`,
                    }}
                  />
                  <span className="font-mono text-[10px] whitespace-nowrap text-muted-foreground">
                    {formatDepth(setting.depth.reach[1])}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <Fact claim={setting.depth.claim}>
                    {setting.depth.range
                      ? `Recorded ${setting.depth.range[0]}–${setting.depth.range[1]} m · `
                      : 'Depth in metres not established · '}
                    {setting.depth.words}
                  </Fact>
                  {night && nightNote[species.id] && (
                    <Fact claim={nightNote[species.id]!.claim}>
                      {nightNote[species.id]!.text}
                    </Fact>
                  )}
                </div>
              </Card>
            )}
          </div>
          <div className="float float-actions pointer-events-auto rounded-2xl border-0 bg-card/95 shadow-[0_0_0_1px_var(--cp-border),0_12px_32px_color-mix(in_srgb,var(--cp-text)_12%,transparent)] backdrop-blur-md flex items-center gap-1 rounded-full p-1">
            <div className="flex items-center" role="group" aria-label="Zoom">
              <Button
                variant="ghost"
                size="icon-lg"
                className="rounded-full"
                aria-label="Zoom in"
                disabled={actual}
                onClick={() => act('zoom-in')}
              >
                <ZoomIn />
              </Button>
              <Button
                variant="ghost"
                size="icon-lg"
                className="rounded-full"
                aria-label="Zoom out"
                disabled={actual}
                onClick={() => act('zoom-out')}
              >
                <ZoomOut />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="lg"
              className="rounded-full max-md:hidden"
              onClick={() => act('reset')}
            >
              <RotateCcw />
              Reset view
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setSourcesOpen(true)}
            >
              <BookOpen />
              <span className="max-md:sr-only">Sources</span>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="rounded-full"
                  aria-label={
                    theme === 'dark'
                      ? 'Switch to light mode'
                      : 'Switch to dark mode'
                  }
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? <Sun /> : <Moon />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </TooltipContent>
            </Tooltip>
          </div>

          <Card
            className="float life-panel pointer-events-auto rounded-2xl border-0 bg-card/95 shadow-[0_0_0_1px_var(--cp-border),0_12px_32px_color-mix(in_srgb,var(--cp-text)_12%,transparent)] backdrop-blur-md gap-0 py-0"
            aria-labelledby="phase-title"
            role="complementary"
          >
            <ScrollArea className="min-h-0 flex-1">
              <div className="grid gap-4 p-5">
                <div className="grid gap-1">
                  <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                    {String(phaseIndex + 1).padStart(2, '0')} /{' '}
                    {String(phases.length).padStart(2, '0')}
                  </p>
                  <h2
                    id="phase-title"
                    className="text-[26px] font-normal tracking-tight"
                  >
                    {phase.label}
                  </h2>
                  <p className={`clock${clock.known ? '' : ' unknown'}`}>
                    {clock.label}
                  </p>
                </div>
                {action.button && (
                  <Button
                    size="lg"
                    className="action-button h-11 justify-self-start rounded-full bg-brand px-5 text-brand-foreground hover:bg-brand/85"
                    onClick={runAction}
                    aria-pressed={
                      frame.phase === 'growth' ? growing : undefined
                    }
                  >
                    <Hand />
                    {frame.phase === 'growth' && growing
                      ? 'Stop growing'
                      : action.button}
                  </Button>
                )}
                <HowItMoves
                  species={species}
                  phase={frame.phase}
                  night={night}
                  onNight={() => setTheme('dark')}
                />
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
                <Separator />
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
                    <dd title={species.drawnNote}>
                      {species.lengthMm.drawn} mm
                    </dd>
                  </div>
                </dl>
              </div>
            </ScrollArea>
          </Card>

          <Card className="float float-bottom pointer-events-auto rounded-2xl border-0 bg-card/95 shadow-[0_0_0_1px_var(--cp-border),0_12px_32px_color-mix(in_srgb,var(--cp-text)_12%,transparent)] backdrop-blur-md gap-2 px-4 py-3">
            <section
              className="timeline"
              id="timeline"
              aria-label="Life timeline"
            >
              <Button
                size="icon-lg"
                className="play size-12 rounded-full bg-brand text-brand-foreground hover:bg-brand/85"
                onClick={() => {
                  if (t >= 1) setT(0)
                  setPlaying(!playing)
                }}
                aria-label={playing ? 'Pause the life' : 'Play the life'}
              >
                {playing ? (
                  <Pause className="fill-current" />
                ) : (
                  <Play className="fill-current" />
                )}
              </Button>
              <div className="track">
                <Slider
                  className="h-8"
                  min={0}
                  max={1000}
                  step={1}
                  value={[Math.round(t * 1000)]}
                  onValueChange={([value]) => {
                    setPlaying(false)
                    setT((value ?? 0) / 1000)
                  }}
                  thumbProps={{
                    'aria-label': 'Life timeline',
                    'aria-valuetext': `${phase.label}. ${clock.label}`,
                  }}
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
            <Separator />
            <div className="figure-tools">
              <div className="look-slider">
                <span aria-hidden="true">Drawing</span>
                <Slider
                  className="w-36"
                  min={0}
                  max={100}
                  value={[Math.round(look * 100)]}
                  onValueChange={([value]) => setLook((value ?? 0) / 100)}
                  thumbProps={{
                    'aria-label': 'Drawing or realistic',
                    'aria-valuetext':
                      look < 0.15
                        ? 'Educational drawing'
                        : look > 0.85
                          ? 'Realistic'
                          : `${Math.round(look * 100)}% realistic`,
                  }}
                />
                <span aria-hidden="true">Realistic</span>
              </div>
              <div
                className="figure-views flex flex-wrap gap-1.5"
                role="group"
                aria-label="Turn"
              >
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setTurntable(false)
                    act('front')
                  }}
                >
                  Front view
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setTurntable(false)
                    act('iso')
                  }}
                >
                  Isometric
                </Button>
                <Toggle
                  variant="outline"
                  className="rounded-full data-[state=on]:bg-foreground data-[state=on]:text-background"
                  pressed={turntable}
                  onPressedChange={setTurntable}
                  disabled={reducedMotion}
                >
                  <Rotate3d />
                  Turntable
                </Toggle>
              </div>
              {frame.animal > 0 && frame.larva === 0 && (
                <div className="take-apart">
                  <Layers aria-hidden="true" className="size-4" />
                  <span aria-hidden="true">Take apart</span>
                  <Slider
                    className="w-36"
                    min={0}
                    max={100}
                    value={[Math.round(apart * 100)]}
                    onValueChange={([value]) => setApart((value ?? 0) / 100)}
                    thumbProps={{
                      'aria-label': 'Take apart',
                      'aria-valuetext':
                        apart > 0.05
                          ? `Body pulled ${Math.round(apart * 100)}% out of the shell`
                          : 'Body inside the shell',
                    }}
                  />
                </div>
              )}
            </div>
          </Card>
          <p className="sr-only" id="sim-summary">
            {summary}
          </p>
        </section>
      </main>

      <div id="where">
        <WhereFound
          species={species}
          originId={origin.id}
          onOrigin={choosePlace}
          fact={(claim, children) => <Fact claim={claim}>{children}</Fact>}
        />
      </div>
      <div id="lab">
        <Suspense
          fallback={
            <p className="model-note" role="status">
              Preparing the shell lab…
            </p>
          }
        >
          <ShellLab reducedMotion={reducedMotion} />
        </Suspense>
      </div>

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
      <EvidenceLibrary open={sourcesOpen} onOpenChange={setSourcesOpen} />
      <CalibrationDialog
        open={calibrateOpen}
        onOpenChange={setCalibrateOpen}
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
