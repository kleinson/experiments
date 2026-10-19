# SeaTreasures

**Hold the architecture of a life.** An open-source, interactive natural-history
experiment by Andreas Kleiner, part of
[kleinson/experiments](https://github.com/kleinson/experiments).

A mobile-first, five-moment experiment about a selected Hawaiian tiger cowrie:
discovery, identification, its living builder, conceptual growth, and the meaning
left in a shell. The object is the explanation: an original dimensional cowrie
with a real opening, modeled lip and teeth, mantle coverage, and a hypothetical
repair mark. Anatomy plates show every stage of the shell, the animal inside it,
and how the shell wall is built. There are no stock photographs, remote fonts,
camera requests, uploads, accounts, identification models, or paid APIs.

The web client uses React 19, TypeScript, Vite, and a lazy-loaded Three.js renderer.
The native companion is a genuine SwiftUI application, not an embedded website.
Both use the same evidence and experience JSON.

## Open source

SeaTreasures is released under the [MIT License](LICENSE). Contributions are
welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Every factual statement must
cite a source in [`data/claims.json`](data/claims.json), so scientific
corrections are the most valuable contributions of all.

Third-party code: the isometric drawing kit in `src/anatomy/kit/` comes from the
[Anatomy skill](https://skills.wheresryan.sh/anatomy) and keeps its own MIT
licence. All shell, animal and icon artwork is original.

## Run the web experiment

Requires Node 22.18+ and npm. Run every command from this `SeaTreasures/` folder.

```sh
npm ci
npm run dev -- --port 5174 --strictPort
```

Open **http://127.0.0.1:5174/seatreasures/**. This deliberately leaves the
portfolio's usual port 5173 alone.

For a production preview, including the offline copy:

```sh
npm run build
npm run preview -- --port 5176 --strictPort
```

Open **http://127.0.0.1:5176/seatreasures/**. After the first successful load,
the “Offline ready” status confirms that the complete local asset set, including
the 3D renderer and sources, has been cached. Original source websites still need
a connection. Development mode intentionally does not install a service worker.

The default deployment path is `/seatreasures/`. For a project-site prefix:

```sh
BASE_PATH=/experiments/seatreasures/ npm run build
```

Serve the contents of `dist/` at that path. No hosting account or
deployment is configured automatically.

## Native iOS companion

See [the iOS instructions](ios/README.md).

```sh
npm run sync:ios
npm run test:ios
open ios/SeaTreasures.xcodeproj
```

The portable model tests run with the Swift command-line tools. Building or
running the **iOS application itself requires full Xcode and an iOS SDK**.
Command-line tools alone do not validate SwiftUI compilation, signing,
simulator behavior, VoiceOver, or on-device performance.

## Scientific boundaries

- This is a **selected demo**, not an identification service. No confidence
  percentage is invented.
- The shell, animal, tissue highlight, growth shapes, and repair mark are
  original explanatory illustrations, not a scan or a diagnostic reconstruction.
- The stage slider is **not a timeline**. Shape changes, relative scale, and
  opening closure are conceptual, not measured rates.
- The adult reference length is adjustable and independent of stage. The
  default 110 mm is an example, not a measurement of a physical specimen.
- Chosen size comparisons are not population percentiles, market valuations,
  rarity scores, birthdays, or lifespan estimates.
- The demo has **no validated subspecies-specific length-to-age model**. It does
  not claim that no such study could ever exist.
- Species, family, and general mollusk evidence are explicitly distinguished
  from subspecies evidence. The currency story must not be generalized to every
  cowrie.
- Local notes are saved only on the current device. The displayed save date is
  not a field-collection date. Damaged or blocked storage is disclosed rather
  than silently overwritten.

The [source manifest](data/claims.json) records each substantive
claim, source, publisher, URL, access date, evidence scope, confidence, and caveat.
It is available inside the experience without a network connection.

## Anatomy plates

Three interactive isometric plates sit under the main specimen. They were made
with the [Anatomy skill](https://skills.wheresryan.sh/anatomy) (MIT), whose rule
is “the object is the explanation”: each plate is a real object, built from many
small solid parts, with one lit accent, a card with a live readout, and no labels
inside the drawing. The kit's camera, solids, card and tone vocabulary are
vendored in `src/anatomy/kit/` with its licence; colours come
only from the site's `--cp-*` tokens, in light and dark.

| Plate                               | Where         | What moves                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fig. 1 · Every shell it was**     | Growth & time | A museum specimen drawer holds the cowrie at all four conceptual stages, top-side up behind and aperture-side up in front. Tapping a compartment or pressing ← → sets the same growth control the 3D shell uses. The drawer front carries a millimetre ruler.                                                                                                                                                  |
| **Fig. 2 · The animal inside**      | The builder   | A living cowrie on a display stand. A section plane cuts away the near upper quarter of the shell to show the porcelain wall in section, the earlier whorls the last whorl encloses, and the gill, osphradium, heart, kidney, stomach, digestive gland, gonad, gut and radula. The mantle lobes follow the builder's coverage control. Tap a part, use the chips, or press ← →. An idle tour visits each part. |
| **Fig. 3 · How the shell is built** | Growth & time | A stepped block cut from the shell wall: three mineral layers of thin plates, the newest glossy coat growing as crystal columns, and the mantle's secreting cells above it, lit as the builder. A control lays the coat down; the readout and facts state composition.                                                                                                                                         |

The curved bodies (shells, tissue, organs) are drawn by a small surface painter
(`anatomy/surface.ts`) in the kit's camera: facets are clipped exactly against
the section plane, shaded in thirteen interpolated tones, and depth sorted, or
merged into one path per tone where a convex body cannot overlap itself. Every
shell in the plates comes from the same `shellPoint` model as the 3D view.
Selecting a part changes one scoped CSS rule rather than redrawing the plate.

Scientific boundaries specific to the plates:

- Organ shapes, sizes and positions are simplified and illustrative. The plate
  names only parts supported by the manifest, and each note shows the evidence
  scope (cowries as a family, or snails generally) and confidence.
- Living tissue is toned differently from shell so the two can be told apart.
  This is a drawing convention, not natural colour.
- A cowrie-specific shell microstructure could not be verified, so Fig. 3 shows
  generic layered mineral and says so. Composition (mostly aragonite, about 1–5%
  organic by weight) is sourced for aragonitic sea-snail shells generally.
- Fluid chemistry between mantle and shell is not drawn because it was not
  verified for this demo.

## Accessibility and rendering

- Native controls for growth, length, mantle coverage, and notes.
- Touch/pointer rotation, keyboard arrow rotation, Home reset, and explicit
  top/underside presets.
- Visible focus, logical headings, a skip link, modal focus handling, and live
  text equivalents of the shell state.
- No autoplay. Rendering is on demand and stops when hidden or offscreen.
- Reduced-motion preferences disable inertial turning and control transitions.
- An original interactive SVG alternative appears if WebGL is unavailable or
  its context is interrupted. The story, controls, sources, and collection do
  not depend on advanced graphics.
- Light/dark system appearance, a manual toggle, and optional
  `?scoutTheme=light` or `?scoutTheme=dark`.

## Validation

```sh
npm run format
npm run check
npx playwright install chromium webkit
npm run test:e2e
npm run test:ios
```

`check` runs formatting checks, lint, type checking, the production build, and
native Node unit tests. Browser tests exercise the complete journey, actual
render changes, persistence/removal, damaged/denied storage, no-WebGL fallback,
offline reload, keyboard operation, reduced motion, theme behavior, 200% layout
zoom, and 320/375/430/768/1280 CSS-pixel layouts.
Separate WebKit touch tests cover the phone journey at 320/375/430 CSS pixels,
system appearance, reduced motion, and reopening the cached experience offline.
Plate tests cover part highlighting, opening and closing the section, the shared
mantle and growth controls, the wall control and its sourced composition, the
idle tour stopping when the reader takes over, and 320/390 CSS-pixel layouts.

The prepared CI definition runs web checks, browser tests, portable native-model
tests, and an unsigned generic iOS Simulator build in full Xcode. Publishing that
workflow was rejected by both available authenticated GitHub connections
(HTTP 404); it is preserved in the local branch `ci/check-workflow` and is not on GitHub.
CI has therefore **not run**. Publishing it requires GitHub workflow-write
permission.

Local verification passed formatting, lint, TypeScript, the production build,
32 Node tests, 32 browser tests (27 Chromium, 5 WebKit), and 22 portable Swift
tests. Chromium and WebKit exercise the
production build, including actual foreground pixels in each conceptual stage
and recovery from an already-running graphics context being lost. A successful
Swift package test is **not** a substitute for an iOS application build.
The iOS UI still needs a full-Xcode build, simulator review, and device testing.

The 3D renderer is a separately loaded approximately 568 kB minified chunk
(approximately 143 kB compressed); Vite reports its standard 500 kB warning.
It is not part of the initial React render and is included in the offline cache.
No warning threshold was raised to conceal that tradeoff.

## Map of the implementation

| Location                | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `data/`                 | Canonical experience model and sourced claims              |
| `src/App.tsx`           | Five-moment product journey and local collection           |
| `src/model.ts`          | Growth, size, accessible summaries, collection validation  |
| `src/geometry.ts`       | Original parametric cowrie geometry and seeded spots       |
| `src/ShellFigure.tsx`   | On-demand 3D renderer and direct manipulation              |
| `src/ShellFallback.tsx` | Advanced-rendering alternative                             |
| `src/anatomy/`          | The three Anatomy plates, surface painter and vendored kit |
| `src/theme.css`         | Shared light/dark visual tokens                            |
| `ios/`                  | Native SwiftUI project and portable Swift package          |
| `tests/`, `e2e/`        | Unit and production-browser tests                          |
| `scripts/`              | Native data synchronization and versioned offline bundling |

## Deliberately not included

Real photo identification, a live-camera pipeline, calibrated age/growth
predictions, user uploads, geolocation, cloud collections, payment processing,
and App Store distribution are not implemented or simulated as if they were.
No protected reference artwork or source code was copied. The Anatomy reference
informed the interaction principle, not the composition.

Web install icons and the opaque native app icon are rendered from the original
`shell-mark.svg`. `npm run icons` regenerates them using the development browser
runtime; regenerating icons is not needed to build or run the app.

## Three next steps—not part of this completed slice

1. Build and test the native target in full Xcode, including VoiceOver, Dynamic
   Type, reduced motion, and a physical iPhone.
2. Have a malacologist review the conceptual juvenile-to-adult geometry and
   species/subspecies wording before using this as a scientific teaching tool.
3. Add a second deeply sourced specimen and test whether the same object-first
   journey remains understandable without becoming a database.
