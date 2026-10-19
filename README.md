# Experiments

Small, working explorations by Andreas Kleiner. The repository was empty when
**The Shell Remembers** was started; no existing application, conventions, or
validation scripts were replaced.

## The Shell Remembers

**Hold the architecture of a life.**

A mobile-first, five-moment experiment about a selected Hawaiian tiger cowrie:
discovery, identification, its living builder, conceptual growth, and the meaning
left in a shell. The object is the explanation: an original dimensional cowrie
with a real opening, modeled lip and teeth, mantle coverage, and a hypothetical
repair mark. There are no stock photographs, remote fonts, camera requests,
uploads, accounts, identification models, or paid APIs.

The web client uses React 19, TypeScript, Vite, and a lazy-loaded Three.js renderer.
The native companion is a genuine SwiftUI application, not an embedded website.
Both use the same evidence and experience JSON.

### Run the web experiment

Requires Node 22.18+ and npm.

```sh
npm ci
npm run dev -- --port 5174 --strictPort
```

Open **http://127.0.0.1:5174/shell-remembers/**. This deliberately leaves the
portfolio's usual port 5173 alone.

For a production preview, including the offline copy:

```sh
npm run build
npm run preview -- --port 5176 --strictPort
```

Open **http://127.0.0.1:5176/shell-remembers/**. After the first successful load,
the “Offline ready” status confirms that the complete local asset set, including
the 3D renderer and sources, has been cached. Original source websites still need
a connection. Development mode intentionally does not install a service worker.

The default deployment path is `/shell-remembers/`. For a project-site prefix:

```sh
BASE_PATH=/experiments/shell-remembers/ npm run build
```

Serve the contents of `dist/shell-remembers/` at that path. No hosting account or
deployment is configured automatically.

### Native iOS companion

See [the iOS instructions](shell-remembers/ios/README.md).

```sh
npm run sync:ios
npm run test:ios
open shell-remembers/ios/TheShellRemembers.xcodeproj
```

The portable model tests run with the Swift command-line tools. Building or
running the **iOS application itself requires full Xcode and an iOS SDK**.
Command-line tools alone do not validate SwiftUI compilation, signing,
simulator behavior, VoiceOver, or on-device performance.

### Scientific boundaries

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

The [source manifest](shell-remembers/data/claims.json) records each substantive
claim, source, publisher, URL, access date, evidence scope, confidence, and caveat.
It is available inside the experience without a network connection.

### Accessibility and rendering

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

### Validation

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

CI runs web checks, browser tests, and portable native-model tests. A successful
Swift package test is **not** a substitute for an iOS application build; the
native CI job also performs an unsigned generic iOS Simulator build in full
Xcode. Local CLT-only checks cannot run that build.

The 3D renderer is a separately loaded approximately 568 kB minified chunk
(approximately 143 kB compressed); Vite reports its standard 500 kB warning.
It is not part of the initial React render and is included in the offline cache.
No warning threshold was raised to conceal that tradeoff.

### Map of the implementation

| Location                                | Purpose                                                    |
| --------------------------------------- | ---------------------------------------------------------- |
| `experiments.json`                      | Gallery registration and original preview                  |
| `shell-remembers/data/`                 | Canonical experience model and sourced claims              |
| `shell-remembers/src/App.tsx`           | Five-moment product journey and local collection           |
| `shell-remembers/src/model.ts`          | Growth, size, accessible summaries, collection validation  |
| `shell-remembers/src/geometry.ts`       | Original parametric cowrie geometry and seeded spots       |
| `shell-remembers/src/ShellFigure.tsx`   | On-demand 3D renderer and direct manipulation              |
| `shell-remembers/src/ShellFallback.tsx` | Advanced-rendering alternative                             |
| `shell-remembers/src/theme.css`         | Shared light/dark visual tokens                            |
| `shell-remembers/ios/`                  | Native SwiftUI project and portable Swift package          |
| `shell-remembers/tests/`, `e2e/`        | Unit and production-browser tests                          |
| `scripts/`                              | Native data synchronization and versioned offline bundling |

### Deliberately not included

Real photo identification, a live-camera pipeline, calibrated age/growth
predictions, user uploads, geolocation, cloud collections, payment processing,
and App Store distribution are not implemented or simulated as if they were.
No protected reference artwork or source code was copied. The Anatomy reference
informed the interaction principle, not the composition.

Web install icons and the opaque native app icon are rendered from the original
`shell-mark.svg`. `npm run icons` regenerates them using the development browser
runtime; regenerating icons is not needed to build or run the app.

### Three next steps—not part of this completed slice

1. Build and test the native target in full Xcode, including VoiceOver, Dynamic
   Type, reduced motion, and a physical iPhone.
2. Have a malacologist review the conceptual juvenile-to-adult geometry and
   species/subspecies wording before using this as a scientific teaching tool.
3. Add a second deeply sourced specimen and test whether the same object-first
   journey remains understandable without becoming a database.
