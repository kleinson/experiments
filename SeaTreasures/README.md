# SeaTreasures

**One sea-shell simulator, from egg to the beach.** An open-source natural-history
experiment by Andreas Kleiner, part of
[kleinson/experiments](https://github.com/kleinson/experiments).

Pick a species and one of the seas and islands where it has really been
recorded. Turn the shell, see through it, cut it open,
or lift it off the animal that built it. Then scrub through a whole life: eggs
you can hatch, a larva you can steer, a shell you grow by holding it, an animal
that pulls back when you poke it, its death, the empty shell a hermit crab moves
into or that floats away, waves that roll and wear it on the beach, and finally
the moment you pick it up.

Everything is drawn as an educational figure, not a photograph: flat colour in
three tones, dark ink outlines, a flat printed shadow on warm paper and leader
labels you can tap, in the spirit of hand-inked isometric explainers such as
April Zhu's [Colorfigures](https://april-zhu.com/colorfigures-demo).

Every fact on screen links to a source. Where a time or size is not known, the
simulator says so rather than guessing. There are no stock photographs, remote
fonts, camera requests, uploads, accounts or paid APIs.

| Species            | Name in the register | What to try                                       |
| ------------------ | -------------------- | ------------------------------------------------- |
| Tiger cowrie       | _Cypraea tigris_     | The mantle that wraps and polishes the shell      |
| Money cowrie       | _Monetaria moneta_   | A small shell once used as money                  |
| Textile cone       | _Conus textile_      | A pattern that records its own growth; venomous   |
| Queen conch        | _Aliger gigas_       | The best-documented life: every stage has a time  |
| Chambered nautilus | _Nautilus pompilius_ | A cephalopod: chambers that float the empty shell |

The web client uses React 19, TypeScript, Vite and Three.js. A native SwiftUI
companion shares the same evidence manifest.

## Open source

SeaTreasures is released under the [MIT License](LICENSE). Contributions are
welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Every factual statement must
cite a source in [`data/claims.json`](data/claims.json), so scientific
corrections are the most valuable contributions of all.

Third-party code: the isometric drawing kit in `src/anatomy/kit/` comes from the
[Anatomy skill](https://skills.wheresryan.sh/anatomy) and keeps its own MIT
licence. All shell, animal and icon artwork is original.

Inspiration: the coiled shells are generated with Raup's logarithmic-spiral
coiling model, the same family of models behind Gene Kogan's
[SeashellGenerator](https://github.com/genekogan/SeashellGenerator) and Jorge
Picado's shell geometry. The cone's tent pattern follows Meinhardt's description
of pigment patterns as a space-time record of the growing edge. Taxonomy follows
[MolluscaBase / WoRMS](https://www.molluscabase.org/). No code or artwork from
these sources was copied.

## Run it

Requires Node 22.18+ and npm. Run every command from this `SeaTreasures/` folder.

```sh
npm ci
npm run dev -- --port 5174 --strictPort
```

Open **http://127.0.0.1:5174/seatreasures/**. Add `?species=queen-conch` (or any
species id) to open a particular shell.

For a production preview, including the offline copy:

```sh
npm run build
npm run preview -- --port 5176 --strictPort
```

After the first load, “Offline ready” means the whole simulator, its 3D
renderer and its sources are cached. Original source websites still need a
connection. The default deployment path is `/seatreasures/`; set `BASE_PATH`
to change it, then serve `dist/`.

## Where it is found

Each species has a world map and a list of 46 named seas and famous islands,
from the Red Sea, Maldives and Great Barrier Reef to Hawaii, Tahiti, Rapa Nui,
the Galápagos, the Bahamas and the Mediterranean. Every place shows how many
located records [GBIF](https://www.gbif.org/) holds there: museum specimens and
observations, leaving out fossils and automated tag detections. Picking a place
sets the shell's origin.

- **Records are not abundance.** They show where people have looked, collected
  and photographed. A place with none may simply be unsurveyed.
- **Outliers are flagged.** Where a species' native range is sourced, records
  outside it (a queen conch in the Philippines) are marked, because they may be
  errors, imports, or shells moved by people or currents.
- **Fewer than 5 records** in a place are shown as isolated.
- `npm run ranges` refreshes the counts from GBIF (network needed) and rewrites
  `data/ranges.json` and the GBIF claims. Region outlines are simple
  latitude/longitude boxes; the coastline is Natural Earth (public domain) via
  `world-atlas`.

## Shell lab

Under the simulator, the shell lab grows any shell from six numbers using the
parametric model of Contreras-Figueroa & Aragón (2023),
[_Diversity_ 15(3), 431](https://doi.org/10.3390/d15030431) (CC BY 4.0). Start
from a published specimen (a wentletrap, top snail, whelk, keyhole limpet,
nautilus, ammonite or clam) and change the whorl expansion, spire height or
aperture, or add ribs and fluted edges, to make shells that may never have
lived. The model is written here from the paper's equations; the specimen
values follow Table 1 as transcribed by
[mollusc3d](https://github.com/ludi317/mollusc3d), which inspired the lab. The
scallop is tuned here and is labelled as not from the paper.

## How it works

**One timeline, eight parts of a life.** Egg, larva, growing, adult, death,
empty shell, beach, found. Real durations range from days to decades, so each
part gets a readable share of the scrubber and a clock beside it reports the
sourced time, or “not established”.

**Shells are grown, not modelled.** Coiled shells are a tube swept along a
logarithmic helicospiral (`src/sim/coil.ts`). A snail only adds shell at its
opening, so a younger shell is literally the same coil, cut off earlier: the
size grows exponentially with the angle, and the built angle grows with the
logarithm of size. The texture is laid out the same way: across the shell is
when that part was made, so a pattern is a record of the growing edge over time.
The cowries reuse the original cowrie model, with the opening narrowing and
teeth forming as they mature.

**Patterns are generated from a seed** (`src/sim/patterns.ts`): spots for the
tiger cowrie, a plain gold shell with a ring for the money cowrie, travelling
waves that spread and close into “tents” for the textile cone, blotches for the
conch and flame stripes that fade toward the opening for the nautilus. They are
illustrations of each species' described pattern, not scans. On the beach the
same pattern fades and chalks as waves wear it.

**True size.** “Actual size” draws the shell at its drawn length in millimetres.
Browsers guess 96 pixels per inch, so “Calibrate” lets you match an on-screen
outline to any bank card (ISO/IEC 7810 ID-1, 85.60 × 53.98 mm) and remembers the
result on your device.

**One ocean floor.** The whole simulator is a full-screen sea with floating
panels (built with [shadcn/ui](https://ui.shadcn.com/) on Radix and Tailwind,
themed with the page's own tokens). The seabed is drawn from each species'
sourced habitat and the chosen place (`src/sim/seabed.ts`,
`src/sim/seafloor.ts`): coral heads, rubble, rippled sand, seagrass meadows,
kelp and brown algae, rocky and volcanic reefs, a deep reef slope, the beach,
or open water for drifting larvae. Under water (`src/sim/water.ts`) sunlight
is focused into moving caustics on everything facing up, red light fades
first, and the far seabed dissolves into the water colour; a small school of
generic reef fish and suspended particles drift past. The scenery is an
illustration, not a survey of what lives at that place, and says so. The
shell menu shows every species as its empty shell and its living animal.

**Drawing or realistic.** The 3D scene is real geometry you can turn, shown
two ways (`src/sim/ink.ts`) and blended by the “Drawing ↔ Realistic” slider.
The drawing is an educational plate: soft tonal washes on a smooth light ramp,
crisp patterns, a fine anti-aliased ink outline around silhouettes and
overlaps, lighter lines along folds, and a soft tinted shadow on the paper. The
realistic end keeps the physical materials, filmic response and a neutral
shadow. In between, the two are mixed and the ink fades out. Ink and shadow
colours come from the page theme, so the figure follows light and dark.

**Labels that teach.** “Labels” draws leader lines to the parts present in the
current moment: apex, body whorl, aperture and columella on a snail shell; the
dorsum and toothed aperture on a cowrie; septum, siphuncle and living chamber
on a nautilus; foot, mantle, siphon, eye stalks, proboscis, operculum, hood,
tentacles and funnel on the animals; egg capsules, the velum and the larval
shell early in life; and drill holes or a hermit crab later. Parts inside the
shell appear only when it is cut open or seen through. Tapping a label opens a
short explanation with its evidence (`src/sim/glossary.ts`). Part names come
from the Gastropod shell, Veliger, Nautilus and Septum articles, recorded as
claims in `data/research/figure-terms.json`.

**The animals.** Each living mollusc has one soft head-foot that carries the
shell, with a mottled skin coloured from its sourced description: the
textile cone is white mottled with tan and has a black-and-red banded siphon;
the money cowrie's mantle is zebra-like; the tiger cowrie's mantle carries
short papillae; the queen conch has long eye stalks, a proboscis and a brown
operculum; the nautilus has a hood, more than 90 slender tentacles, large eyes
and a funnel. Where no colour is sourced (conch and nautilus skin) a neutral
tone is used.

**Things to touch.**

| Part of life | Tap or drag                     | What happens                                          |
| ------------ | ------------------------------- | ----------------------------------------------------- |
| Egg          | Tap an egg, or “Hatch them all” | Eggs hatch one by one                                 |
| Larva        | Move the pointer or tap         | Steer the swimming larva, then let it settle          |
| Growing      | Press and hold the shell        | It grows at its opening while you hold                |
| Adult        | Tap the animal                  | It pulls back into its shell, then slowly comes out   |
| Adult        | “Take apart” slider             | Lifts the shell off the soft body inside              |
| Any          | “See-through”, “Cut open”       | See through the shell, or slice it open               |
| Any          | “Labels”, then a label          | Names each part; a tap explains it, with its source   |
| Any          | Style slider, views, turntable  | Drawing to realistic, a side-on plate, or a slow turn |
| Death        | Choose an ending                | Only sourced causes; otherwise “not documented”       |
| Empty shell  | Tap the shell                   | A hermit crab moves in, or a nautilus shell floats    |
| Beach        | Tap the shell                   | A wave rolls it; each wave wears it paler             |
| Found        | Tap the shell                   | You pick it up and it joins your shelf on this device |

## Scientific boundaries

- **Sourced or unknown.** Durations, sizes, ranges, causes of death and legal
  status come from the manifest. If a source does not give a number, the
  simulator says “not established”.
- **Scope is shown.** Each fact's evidence says whether it is about this
  species, its family, or molluscs in general, and how confident it is. The
  cone's egg, larva and lifespan figures are genus-level, and are marked so.
- **Drawn size.** Where a source only gives a maximum, the shell is drawn at an
  ordinary size below it and the panel says so.
- **Illustrations.** Shell geometry, animals, organs, eggs and patterns are
  original illustrations from simple models. The growth curve between birth and
  adult size is illustrative, not a measured rate.
- **Gaps are left as gaps.** The cowries' predators were only found in
  unverified summaries, so no predator is shown for them. A cowrie-specific
  shell microstructure was not verified.
- **Your shelf** is kept only on this device. Damaged or blocked storage is
  disclosed rather than silently overwritten.

## Sources and data

- [`data/claims.json`](data/claims.json): every claim and source, with publisher,
  URL, access date, scope, confidence and caveat. It travels with the app.
- [`data/research/`](data/research/): the research fragments, one per batch of
  species, as read from the sources.
- [`data/species.json`](data/species.json): generated by `npm run species` from the
  fragments. After editing a fragment run `npm run species`, then
  `npm run sync:ios`.

Main references include NOAA Fisheries species profiles (queen conch, chambered
nautilus), WoRMS / MolluscaBase records, peer-reviewed work on cowrie breeding,
cone snails, post-mortem nautilus drift and predator boreholes, and Wikipedia's
Mollusca article for phylum-wide facts.

## Field plates (tiger cowrie)

Under the simulator, the tiger cowrie keeps two interactive isometric plates made
with the [Anatomy skill](https://skills.wheresryan.sh/anatomy): a see-through
cutaway of the living animal and its organs, and a stepped section of the shell
wall where the mantle lays down new mineral. Their curved bodies are drawn by a
small surface painter (`src/anatomy/surface.ts`) in the kit's isometric camera.

## Accessibility

- Every interaction on the stage also has a button, slider or radio control.
- The stage turns with the arrow keys; Home resets it. The timeline is a native
  slider with Home and End.
- A live region announces what happened after each action; a hidden summary
  describes the current scene.
- Labels are real buttons in a list; each opens its explanation and evidence.
- Reduced motion stops bobbing, swimming, tumbling and the turntable; actions jump
  straight to their result.
- If WebGL is unavailable, the timeline, facts, sources and shelf still work.
- Light and dark appearance, a manual toggle, and `?scoutTheme=light|dark`.

## Validation

```sh
npm run check            # formatting, lint, types, build, unit tests
npx playwright install chromium webkit
npm run test:e2e         # Chromium and WebKit, against the production build
npm run test:ios         # portable Swift core tests
```

Browser tests cover choosing every species, the map and place list, the shell
lab, a whole life from egg to shelf,
hatching eggs by tapping the stage, see-through, cut open and take apart, part
labels and their sourced explanations, the drawing-to-realistic slider and
views, actual size
and calibration, sourced and unknown durations, the sources dialog, keyboard
turning and timeline, text contrast in both themes, 320 and 390 pixel phones,
no-WebGL operation, offline reload, and WebKit touch at 320, 375 and 430 pixels.

The prepared CI definition is kept on the local branch `ci/check-workflow`;
publishing it needs GitHub workflow-write permission, so CI has not run. The
iOS app still needs a full-Xcode build and device testing, and does not yet
include the simulator.

The 3D renderer is a separately loaded chunk of about 590 kB minified (about
150 kB compressed); Vite reports its standard 500 kB warning. It is cached for
offline use.

## Map of the implementation

| Location                 | Purpose                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `src/sim/Simulator.tsx`  | The one-screen simulator: species, timeline, facts and shelf  |
| `src/sim/Stage.tsx`      | The 3D stage: camera, true size, taps, motion and labels      |
| `src/sim/ink.ts`         | Drawn and realistic looks, ink outlines and the blend         |
| `src/sim/labels.ts`      | Named points on parts, and collecting them for the figure     |
| `src/sim/glossary.ts`    | What each label means, and the claim it rests on              |
| `src/sim/scene.ts`       | Builds each frame: shell, animal, eggs, larva, crab, labels   |
| `src/sim/coil.ts`        | Raup coiling model and accretionary growth                    |
| `src/sim/patterns.ts`    | Seeded pattern generators and weathering                      |
| `src/sim/life.ts`        | The eight-part life timeline and its sourced clock            |
| `src/sim/species.ts`     | Typed, validated species data                                 |
| `src/sim/ranges.ts`      | GBIF records per sea and island, levels and outliers          |
| `src/sim/WhereFound.tsx` | World map and place list; picking a place sets the origin     |
| `src/sim/bodies.ts`      | Soft bodies: skins, head-foot, tapered limbs, papillae        |
| `src/lab/`               | Shell lab: the six-parameter morphospace model and its viewer |
| `src/anatomy/`           | Tiger cowrie field plates, surface painter and vendored kit   |
| `data/`                  | Claims, research fragments, species and cowrie experience     |
| `ios/`                   | Native SwiftUI project and portable Swift package             |
| `tests/`, `e2e/`         | Unit and production-browser tests                             |
| `scripts/`               | Species and GBIF range builds, native sync, icons, offline    |

## Next steps

1. Bring the simulator to the SwiftUI companion and test it on a device.
2. Have a malacologist review the shell geometry, patterns and organ placement.
3. Add bivalves, which build two shells and need a different growth model.
