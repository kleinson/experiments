# The Shell Remembers - native iOS companion

A native, offline SwiftUI vertical slice for iOS 17+. No WebView, external package,
account, camera, analytics or service is required. Canvas draws original procedural
art; this is not a scan, photo identification or biological growth simulation.

## Open and build

Install full Xcode 16 or newer with an iOS SDK and simulator runtime. From the
**experiments repository root**:

```sh
npm run sync:ios
open shell-remembers/ios/TheShellRemembers.xcodeproj
```

Select the shared **TheShellRemembers** scheme and an installed **iOS Simulator**,
then Product > Run. The project references the local `ShellCore` package at `.`;
there are no remote dependencies. Signing is disabled in both app configurations.
Command-line simulator build, from the same repository root:

```sh
xcodebuild \
  -project shell-remembers/ios/TheShellRemembers.xcodeproj \
  -scheme TheShellRemembers \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath shell-remembers/ios/DerivedData \
  CODE_SIGNING_ALLOWED=NO build
```

To run on a physical device, use full Xcode, select your development team, enable
signing locally, and select that device. Those credentials are not part of the
source. An unsigned simulator build does not require a team.

The app target compiles `App/Assets.xcassets` with `AppIcon` selected in Debug and
Release. Its original supplied 1024-square opaque RGB PNG is used through the
iOS universal single-size icon metadata; it is not a placeholder or regenerated
artwork. Asset compilation still requires the full Xcode build above.

## Portable verification

Swift 6 and macOS 14+ Command Line Tools are sufficient for the Foundation-only
core. Tests use native Swift Testing, not XCTest:

```sh
# From the experiments repository root; sync copies both canonical JSON files.
npm run sync:ios
bash shell-remembers/ios/Scripts/test-core.sh
plutil -lint shell-remembers/ios/TheShellRemembers.xcodeproj/project.pbxproj
```

The script executes `swift test --disable-xctest`. With CLT it also supplies
framework and runtime paths for Apple's **already installed** Testing framework;
CLT does not expose that framework on the default Swift search path and does not
ship XCTest. Nothing is downloaded or installed. The exact CLT invocation is:

```sh
swift test --package-path shell-remembers/ios --disable-xctest \
  -Xswiftc -F \
  -Xswiftc /Library/Developer/CommandLineTools/Library/Developer/Frameworks \
  -Xlinker -F \
  -Xlinker /Library/Developer/CommandLineTools/Library/Developer/Frameworks \
  -Xlinker -rpath \
  -Xlinker /Library/Developer/CommandLineTools/Library/Developer/Frameworks \
  -Xlinker -rpath \
  -Xlinker /Library/Developer/CommandLineTools/Library/Developer/usr/lib
```

The wrapper discovers the active developer directory instead of assuming this
path. Full Xcode can use `swift test --package-path shell-remembers/ios
--disable-xctest` directly. On a CLT-only machine, the parent's `test:ios` command
should call this wrapper after synchronization rather than unqualified
`swift test`; parent configuration is not modified here.

Tests exercise the **actual bundled canonical data**, source references, nonempty
scope/confidence/evidence notes, invalid source URLs and access dates, versions,
stage boundaries, finite/clamped geometry math across the progression range,
independent adult size, exact source-reference size boundaries and differences,
size-guide claim references and threshold validation, unknown age, note limits, persistence round trips,
invalid/corrupt collections, write failures and explicit erase/recovery.
The app scheme has no iOS test target; portable tests run through SwiftPM.
The portable suite includes 22 tests, including independent visual length
scaling, unchanged conceptual stage/age, fixed maximum-length framing and the
conceptual aperture-edge highlight's exact cutoff at progression 75.

**Validation limitation:** full Xcode and the iOS SDK are not installed in the
implementation environment. An iOS SDK build, simulator launch, device tests,
VoiceOver interaction tests and visual inspection could not run here.
`plutil -lint` checks project-file syntax, **not iOS typechecking**.
Swift frontend parsing also checks syntax only, not SwiftUI/UIKit API types.
Portable core tests do not establish that the iOS UI builds or renders correctly.
The standalone Canvas artwork passed a Swift typecheck against the available
macOS SDK; that is additional artwork API coverage, not an iOS app typecheck.

## Content and parent integration

- `../data/experience.json` is the shared version-1 experience configuration:
  selected demo, notices, measurements, a sourced size guide and four conceptual
  stage descriptions.
- `../data/claims.json` is the shared version-1 verified claim manifest, owned by
  research. No placeholder manifest is used.
- The parent `scripts/sync-ios.mjs`, via `npm run sync:ios`, copies **both** to
  `Sources/ShellCore/Resources/`. Repeat sync after canonical changes and include
  the synchronized resources with this directory. Bundling uses `Bundle.module`;
  the app never reads files outside its sandbox at runtime.
- Evidence rendering is generic: no claim IDs, confidence values or biological
  assertions are hardcoded into the native UI. Every bundled statement displays
  scope, confidence, evidence note and resolved citations. Full source metadata,
  access notes and URLs are visible offline. Opening an explicitly labeled
  external citation is optional and needs a browser connection.
- Invalid/missing bundled content produces an exhibit error and retry action,
  never a fabricated fallback.

## Journey and interpretation

1. **Discover:** selected demo, original dimensional Canvas artwork, native drag
   turning, reset and an accessible quarter-turn button.
2. **Identify:** uncertainty notice and scoped verified statements. This is not
   an identification tool or a way to rule out look-alikes.
3. **The builder:** a separately controlled rose mantle teaching overlay, explicitly
   not a natural color or coverage claim.
4. **Growth:** conceptual progression `0...100`; stage starts `0/25/50/75`.
   Geometry matches the shared model exactly. The coiled/involute transition,
   aperture, lip marks and surface pattern are anatomy abstractions.
   The growth view starts on the opening side. Below progression `75`, a subtle
   rose outline follows the actual illustrated aperture boundary; it disappears
   at `75`. This is a conceptual teaching edge, not a natural-color observation
   or measured growth rate. It uses no floating anatomy labels.
   Adult demo length is a separate integer `50...160 mm`, initially `110 mm`.
   The `90/120/150 mm` comparisons are chosen illustrations, not rarity,
   typicality, population percentiles or age. Adult length visually scales the
   entire Canvas specimen by `lengthMm / 110`, multiplied by the independent
   conceptual stage scale. Shape proportions, stage selection and age do not
   change with length. Framing is fixed to accommodate `160 mm`, not refitted
   for each selected length, so a `150 mm` specimen is visually `150/90` times
   a `90 mm` specimen at the same conceptual stage. Chronological age is always
   **Unknown**.
   A separate sourced comparison uses the parsed size guide: the reported average
   is approximately `100 mm`; `>125 mm` is labeled large against this one field
   reference; `150...153 mm` is near its reported maximum with the remaining
   millimetres shown; `>153 mm` asks for length/identification rechecking, not a
   record claim. At `125 mm` the ordinary reference comparison still applies.
   At the default `110 mm` it reports `10 mm longer` than the approximate
   reference average. This comparison generates neither age nor population
   percentiles or rarity scores. Its single-specialist-source notice is always
   visible, with the referenced claim's full evidence caveat available inline.
5. **Remember:** a reflection of at most 280 UTF-16 text units (matching the web
   model's JavaScript string-length validation) and a saved
   settings snapshot. Every displayed date is labeled as **save time, not age**.

System text styles support Dynamic Type. Cards scroll rather than fixing text
height. The app adapts off-white/charcoal surfaces and rose contrast to appearance.
VoiceOver receives a text summary instead of the decorative Canvas, semantic
sliders with units, and a turning alternative. Reduced Motion removes journey
transition animation; there is no continuous/automatic animation or hover UI.

## Local storage and errors

The app writes `Application Support/TheShellRemembers/collection-v1.json` in its
own sandbox, atomically, using Foundation. On iOS, the containing directory is
explicitly excluded from system backups before writing; failure to set that flag
is surfaced rather than silently allowing a save. A missing file is an explicit
first-use state. Stored versions, IDs, finite/ranged progression, integer length,
280-unit note limit, unique entry IDs and valid save timestamps are checked
before use. Each save appends a new UUID-tagged entry with its actual save date;
restoring settings does not change the old entry or its timestamp.

Unreadable, malformed or unsupported data blocks saving and is not replaced.
Storage status offers retry or a destructive, confirmed erase. Erase removes the
app's collection file, including corrupted contents; it cannot be undone.
Operation errors are presented, not converted into successful empty collections.
Snapshots include no age inference, location, photograph or upload. Swift's
Codable date representation is used internally; the UI formats it as a localized
save date and time.

Before release, run the iOS build above, then review all five moments at the
largest accessibility text sizes, in light/dark appearance, with VoiceOver and
Reduce Motion. Check drag/turn/reset, both independent sliders, evidence sheets,
save/relaunch/restore, over-limit notes, unreadable-storage recovery, and erase
cancellation/confirmation on an actual simulator or device.
