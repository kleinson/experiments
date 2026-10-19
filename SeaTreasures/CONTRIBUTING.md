# Contributing to SeaTreasures

Thank you for helping. SeaTreasures is a small, carefully scoped experiment, so
the most useful contributions are corrections, accessibility fixes and
well-sourced science.

## Ground rules

- **Every fact needs a source.** Add or change claims only in
  `data/claims.json`, with a directly read source, an evidence scope
  (subspecies, species, family, molluscs) and an honest confidence. Then run
  `npm run sync:ios` so the native app ships the same content.
- **No invented numbers.** No ages from size, growth rates, rarity scores,
  valuations or identification confidence.
- **Original artwork only.** Do not add copyrighted images, scans or code.
- **Accessible by default.** Keyboard, screen-reader text, reduced motion and
  4.5:1 text contrast must keep working.
- **Colours come from theme tokens** (`--cp-*`), never literal values.

## Before opening a pull request

```sh
npm ci
npm run check
npx playwright install chromium webkit
npm run test:e2e
npm run test:ios
```

Keep pull requests focused, describe what you verified, and note anything you
could not test (for example a full Xcode build).

## Licence

By contributing you agree that your contribution is released under the
project's [MIT License](LICENSE).
