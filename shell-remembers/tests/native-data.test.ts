import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('web and native clients bundle byte-identical canonical evidence and experience data', () => {
  for (const name of ['claims.json', 'experience.json']) {
    const canonical = readFileSync(new URL(`../data/${name}`, import.meta.url))
    const native = readFileSync(
      new URL(`../ios/Sources/ShellCore/Resources/${name}`, import.meta.url),
    )
    assert.deepEqual(
      native,
      canonical,
      `Run npm run sync:ios after changing ${name}.`,
    )
  }
})

test('native app icon is original, 1024 square and opaque RGB rather than a placeholder', () => {
  const directory = new URL(
    '../ios/App/Assets.xcassets/AppIcon.appiconset/',
    import.meta.url,
  )
  const png = readFileSync(new URL('AppIcon.png', directory))
  assert.equal(png.subarray(1, 4).toString(), 'PNG')
  assert.equal(png.readUInt32BE(16), 1024)
  assert.equal(png.readUInt32BE(20), 1024)
  assert.equal(png[25], 2, 'The native icon must have no alpha channel.')
})
