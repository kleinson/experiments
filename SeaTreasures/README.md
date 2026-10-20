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

**Filters that narrow each other.** The shell, place and habitat pills float
together at the top. Each narrows the others: a habitat lists only the places
with shells that live in it and shows how many fit here; a habitat no shell
lives in cannot be picked; the shell menu puts the shells that fit first and
says why the others are left out. Picking a habitat the current shell does not
live in switches to the best-recorded shell here that does, or to the best
place for one; picking a shell that does not fit clears the habitat. A shell's
habitats are read from its sourced habitat text (`src/sim/filters.ts`).

**One life, one place.** The life stages run on into each other: eggs hatch one
by one as the timeline plays to the end of the egg stage; late in the larval
stage the larva swims less, tucks its velum in and sinks towards the bottom; a
settled youngster sets off slowly; a dying animal slows to a halt where it is,
and its empty shell stays there, turned the same way, until the waves take it
to the beach.

**The place picks the shells.** The place menu lists every sea and island with
any recorded shell, with how many of the five are found there. Switching place
keeps the current shell if it has been recorded there, and otherwise switches
to the best-recorded shell at the new place (Mauritius → the Bahamas turns a
money cowrie into a queen conch). Picking a shell that was never recorded at
the current place moves to where it is best recorded. The shell menu is split
into “Found at …” with record counts, and “Not recorded at …” with where each
is best found. Both choices are kept in the address (`?species=…&place=…`).

**Local forms.** Where a sourced local form exists it replaces the species at
that place: at Hawaii the tiger cowrie becomes the Hawaiian tiger cowrie,
_Cypraea tigris schilderiana_ C. N. Cate, 1961, drawn larger (100 mm, up to
153 mm) as its sources record (`src/sim/forms.ts`). Its pattern is not changed,
because no source here tells the forms apart by pattern.

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
shell menu shows every species as a studio picture (`src/sim/thumbs.ts`): the
realistic materials photographed on a warm table under soft daylight with a
reflected studio room and a contact shadow, plus small views of its underside
and of the living animal.

**Every place looks like itself.** Each of the 46 recorded places has a
sourced profile (`src/sim/places.ts`, claims in `data/research/places.json`):
table and branching corals in the Coral Triangle and wider Indo-Pacific, soft
and hard corals on the Red Sea's fringing reefs, white sand lagoons on atolls,
granite boulders in the Seychelles, black basalt with yellow tang at Hawaii
and other volcanic islands, elkhorn coral, sea fans and turtle grass in the
Caribbean, pink sand at Bermuda, rocky shores with brown algae in the Gulf of
California, and Neptune grass in the Mediterranean.

**Colours from real photographs.** Each place's water, the colour cast it puts
on everything in it, and its sand are matched to underwater photographs taken
there (`scripts/place-photos.py`). The script searches Wikimedia Commons for
underwater photos of every sea and island, skips photos lit by a flash or taken
out of the water (and a hand-checked list of boats, aquariums and satellite
maps), and measures the open water, the whole frame and pale sand in the rest.
It writes only colour statistics, with each place's photos, authors and
licences, to `data/place-colours.json`; no photo is copied into the project.
Water is converted to the clear, shallow colour the app darkens with depth, so
at about 8 m a reef looks like the photographs, bluer and darker below. Places
with few usable photos borrow from places with the same kind of reef.

**Depth.** Each animal is drawn at a depth from its sources (`src/sim/depth.ts`):
tiger cowries at 10–40 m, money cowries in tide pools, the textile cone in the
shallows, queen conch under about 30 m, and the nautilus several hundred
metres down (as shallow as 5 m only around Vanuatu and New Caledonia). A depth
slider moves within that range: deeper water is darker and bluer, caustics
fade, and below about 60 m there is no coral or seagrass. Dark mode is a night
dive: black water, a diver's torch, no fish, and a note where the animal's
night habits are sourced.

**Zoom.** The scroll wheel, two-finger trackpad scroll, trackpad pinch (and
Safari's pinch gestures), touch pinch, the + and − keys and the zoom buttons
all zoom towards the point under the cursor. Zoomed all the way out, scrolling
carries on down the page; Home or “Reset view” goes back to the whole animal.

**On the move, stage by stage.** How the animal moves follows its sources for
each stage of life and for day or night (light mode is day, dark mode a night
dive), and the life panel says how, with evidence (`src/sim/crawl.ts`, claims
in `data/research/movement.json`):

- **Egg:** attached capsules stay put; a tiger cowrie mother covers hers with
  her foot until they hatch. Broadcast-spawned eggs are shown in open water.
- **Larva:** a veliger swims by beating the cilia on its velum and pulls the
  velum in to sink; near settling, a cowrie larva swims less, spends more time
  on the bottom, then starts to crawl.
- **Growing:** once settled, the young snail moves about on its foot; a young
  queen conch stays buried in the sediment through its first year.
- **Adult:** snails crawl on waves of muscle along the foot, sliding on mucus.
  The tiger cowrie hides by day and forages at night; the textile cone lies
  buried by day and comes out at night; the money cowrie grazes in daylight.
  The queen conch does not crawl: it vaults on its operculum, low and with long
  rests. The nautilus rests around 200 m by day and keeps moving at night,
  jetting backwards, shell first.
- **Death and after:** the animal no longer moves; currents, waves and hermit
  crabs move the shell.

**See-through sand.** When an animal lies buried (a textile cone by day, a
young queen conch), a soft window opens in the sand over it, with damp
sediment beneath, so the buried shell, foot and head can still be seen and
followed. The window is placed along the line of sight, so it shows what lies
under the sand from wherever you look, and it fades as the animal comes out.

**Where the eggs are laid.** The egg stage follows sourced laying sites
(`src/sim/nests.ts`): cowries brood layered capsule masses on rubble, cone
snails attach capsules below rock ledges, queen conch lay sand-coated folded
strands on clean sand, and broadcast spawners release eggs into water.
Nautilus crevices are based on aquarium observations, not wild egg sightings.
The cowrie mother is deliberately offset so the mass remains visible; in life
her foot covers it. Unmeasured nest arrangements and strand dimensions are
illustrative, not reconstructions.

**The larva.** Gastropods have a dedicated translucent, open-coiled protoconch,
not an adult cowrie scaled down (`src/sim/larvae.ts`). The tiger cowrie starts
near 0.22 mm shell length, within the measured 200–242 µm range. Its velum
changes from two kidney-shaped lobes toward four elongated arms, based on
Tay et al. 2023, figures 3–4 (claim `tiger-cowrie-larval-form`). Other snails
borrow this illustrative veliger form; it is not species-specific microscopy.
The velum is drawn as thin lobes on a short head
rising from the shell's opening, each rimmed with a band of long cilia and a
band of short cilia inside it; the cilia beat in waves around the rim
(`src/sim/velum.ts`). Its label explains what the velum is, why the larva has it and
how it works (claims `term-velum-why`, `term-velum-how`). The larva drifts on
its own and holds still while you point at a label or read one; tap the water
to steer it, or tap the larva (or "Tuck in the velum") to see it pull the velum
into its shell.

**In the open water.** Drifting in the plankton, the larva casts no shadow:
there is nothing below it to catch one. Where the sources say larvae hatch
together (tropical cowries, about 740 per egg capsule and most of a brood in
one night, claim `cowrie-hatch-together`; the queen conch's and cone's egg
masses; the giant clam's spawning), six faint sibling veligers drift behind it
(`src/sim/siblings.ts`, one instanced mesh). They are the same size but drawn
smaller and hazier, as a photo would show larvae farther from the lens. Far
off in the blue a loose school of jacks and a lone tuna pass by, drawn at their
real length and distance in the backdrop shader (`src/sim/sky.ts`), so they cost
almost nothing and read as distant beside a larva a fraction of a millimetre
long.

**Suspended particles, not rainfall.** Marine snow uses GPU points, smaller
and dimmer than the previous glowing flakes. Sinking and current speeds are
capped to the current magnified view (`src/sim/suspension.ts`): even the
fastest flake settles no faster than 1.2 pixels/second in an 800-pixel-high
view. The visual cap is intentional; unscaled mm/s would race past a larva
only a fraction of a millimetre long.

A travelling animal follows a loose figure of eight with the camera, light and
shadow following, so the seabed slides past. The pace is sped up to be
watchable. It stops while it hides in its shell, while it is taken apart or a
part is being read; with reduced motion it never travels.

**Attached to its shell.** A crawling snail is posed with its opening down on
its foot; the body runs out of the opening onto the foot, and the camera
cannot swing under the sea floor.

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
shell appear only when it is cut open or seen through. Tapping a label opens a card
right beside it with a TL;DR: what the part is, why the animal has it and how
it works, together in two or three sentences (the operculum as a trapdoor and,
for the conch, a vaulting pole; the siphon for breathing and tasting the water;
the siphuncle for emptying chambers to control buoyancy). Every sentence rests
on the claims listed under its evidence, and where no source says why or how,
the card does not guess (`src/sim/glossary.ts`, claims in
`data/research/part-functions.json`); a test keeps each TL;DR to two or three
sentences. Part names come
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
| Found        | Tap the shell                   | You pick it up, place it in a dry bookshelf display case, and browse documented shell uses |

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
- **Found is dry.** The collection scene removes underwater haze and particles,
  rests the specimen on a wooden display shelf, and shows historical context for
  adornment, trade, sound/ceremony and medicine/belief. Historical medicine is
  labelled as practice and belief, not evidence of clinical effectiveness.

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

| Location                  | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `src/sim/Simulator.tsx`   | The one-screen simulator: species, timeline, facts and shelf  |
| `src/sim/Stage.tsx`       | The 3D stage: camera, true size, taps, motion and labels      |
| `src/sim/ink.ts`          | Drawn and realistic looks, ink outlines and the blend         |
| `src/sim/labels.ts`       | Named points on parts, and collecting them for the figure     |
| `src/sim/glossary.ts`     | Each label's TL;DR (what, why, how) and the claims behind it  |
| `src/sim/scene.ts`        | Builds each frame: shell, animal, eggs, larva, crab, labels   |
| `src/sim/coil.ts`         | Raup coiling model and accretionary growth                    |
| `src/sim/patterns.ts`     | Seeded pattern generators and weathering                      |
| `src/sim/life.ts`         | The eight-part life timeline and its sourced clock            |
| `src/sim/species.ts`      | Typed, validated species data                                 |
| `src/sim/ranges.ts`       | GBIF records per sea and island, levels and outliers          |
| `src/sim/WhereFound.tsx`  | World map and place list; picking a place sets the origin     |
| `src/sim/velum.ts`        | The veliger's velum: lobes, ciliated bands and beating cilia  |
| `scripts/place-photos.py` | Matches place colours to underwater photos (Commons)          |
| `src/sim/filters.ts`      | Which shells live in which habitats; the filters' choices     |
| `src/sim/crawl.ts`        | How each animal moves at each stage, day and night, and where |
| `src/sim/forms.ts`        | Sourced local forms, such as the Hawaiian tiger cowrie        |
| `src/sim/thumbs.ts`       | Studio pictures of each shell, its underside and its animal   |
| `src/sim/bodies.ts`       | Soft bodies: skins, head-foot, tapered limbs, papillae        |
| `src/lab/`                | Shell lab: the six-parameter morphospace model and its viewer |
| `src/anatomy/`            | Tiger cowrie field plates, surface painter and vendored kit   |
| `data/`                   | Claims, research fragments, species and cowrie experience     |
| `ios/`                    | Native SwiftUI project and portable Swift package             |
| `tests/`, `e2e/`          | Unit and production-browser tests                             |
| `scripts/`                | Species and GBIF range builds, native sync, icons, offline    |

## Next steps

1. Bring the simulator to the SwiftUI companion and test it on a device.
2. Have a malacologist review the shell geometry, patterns and organ placement.
3. Add bivalves, which build two shells and need a different growth model.
