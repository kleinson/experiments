import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const species = [
  ['tiger-cowrie', 'Tiger cowrie'],
  ['money-cowrie', 'Money cowrie'],
  ['textile-cone', 'Textile cone'],
  ['queen-conch', 'Queen conch'],
  ['chambered-nautilus', 'Chambered nautilus'],
] as const

const phase = (page: Page, name: string) =>
  page.locator('.phase-ticks button', { hasText: name }).click()
const announced = (page: Page) => page.locator('.sim > [role="status"]')
/** Picks an option from one of the floating selects. */
async function choose(page: Page, trigger: string, value: string) {
  await page.locator(trigger).click()
  await page.locator(`[role="option"][data-value="${value}"]`).click()
}
/** Opens the floating shell menu and picks a species from it. */
async function chooseShell(page: Page, name: string) {
  await page.getByRole('button', { name: 'Shells', exact: true }).click()
  await page
    .locator('#shell-tray')
    .getByRole('button', { name: new RegExp(name) })
    .click()
}

/** Fraction of the stage's pixels that differ clearly from its corner: something is drawn. */
async function drawn(page: Page) {
  const png = (await page.locator('[data-sim-canvas]').screenshot()).toString(
    'base64',
  )
  return page.evaluate(async (data) => {
    const image = new Image()
    image.src = `data:image/png;base64,${data}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No 2D context.')
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let different = 0
    for (let i = 0; i < pixels.length; i += 4) {
      const delta =
        Math.abs(pixels[i]! - pixels[0]!) +
        Math.abs(pixels[i + 1]! - pixels[1]!) +
        Math.abs(pixels[i + 2]! - pixels[2]!)
      if (delta > 60) different++
    }
    return different / (pixels.length / 4)
  }, png)
}

const mmOf = (label: string | null) =>
  Number(label?.match(/(\d+(?:\.\d+)?)\s*mm/)?.[1])

test.use({ reducedMotion: 'reduce' })

test('every species can be chosen and is drawn with its sourced name', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./')
  for (const [id, name] of species) {
    await chooseShell(page, name)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
    await expect(page).toHaveURL(new RegExp(`species=${id}`))
    await expect
      .poll(() => drawn(page), { timeout: 25_000 })
      .toBeGreaterThan(0.02)
    await expect(page.locator('#origin')).toHaveAttribute('data-value', /.+/)
  }
  expect(errors).toEqual([])
})

test('a whole life plays from egg to a shell in your hand', async ({
  page,
}) => {
  await page.goto('./?species=textile-cone')
  await phase(page, 'Egg')
  await expect(page.locator('#phase-title')).toHaveText('Egg')
  await page.getByRole('button', { name: 'Hatch them all' }).click()
  await expect(page.locator('#phase-title')).toHaveText('Larva')
  await expect(announced(page)).toContainText('All hatched')
  await page.getByRole('button', { name: 'Let it settle' }).click()
  await expect(page.locator('#phase-title')).toHaveText('Growing')
  await page.getByRole('button', { name: 'Grow', exact: true }).click()
  await expect(page.locator('#phase-title')).toHaveText('Adult', {
    timeout: 20000,
  })
  await page.getByRole('button', { name: 'Poke it' }).click()
  await expect(announced(page)).toContainText('pulls back into its shell')
  await phase(page, 'Death')
  await expect(page.locator('.choices input')).not.toHaveCount(0)
  await phase(page, 'Empty shell')
  await page.getByRole('button', { name: 'Call a hermit crab' }).click()
  await expect(announced(page)).toContainText('hermit crab')
  await phase(page, 'Beach')
  await page.getByRole('button', { name: 'Send a wave' }).click()
  await expect(announced(page)).toContainText('wave')
  await phase(page, 'Found')
  await page.getByRole('button', { name: 'Pick it up' }).click()
  await expect(announced(page)).toContainText('added to your shelf')
  const shelf = page.getByRole('list', { name: 'Your shelf' })
  await expect(shelf.locator('li')).toHaveCount(1)
  await page.reload()
  await phase(page, 'Found')
  await expect(shelf.locator('li')).toHaveCount(1)
  await page
    .getByRole('button', { name: 'Remove Textile cone from your shelf' })
    .click()
  await expect(shelf).toHaveCount(0)
})

test('tapping eggs on the stage hatches them one by one', async ({ page }) => {
  await page.goto('./?species=chambered-nautilus')
  await phase(page, 'Egg')
  const box = await page.locator('[data-sim-canvas]').boundingBox()
  if (!box) throw new Error('No stage.')
  for (let x = 0.2; x <= 0.8; x += 0.05) {
    await page.mouse.click(box.x + box.width * x, box.y + box.height * 0.6)
    if ((await announced(page).textContent())?.match(/eggs left|All hatched/))
      break
  }
  await expect(announced(page)).toContainText(/eggs left|All hatched/)
})

test('see through, cut open and take apart all change the drawing', async ({
  page,
}) => {
  await page.goto('./?species=queen-conch')
  await phase(page, 'Adult')
  const canvas = page.locator('[data-sim-canvas]')
  const plain = await canvas.screenshot()
  const changed = () =>
    expect
      .poll(async () => (await canvas.screenshot()).equals(plain))
      .toBe(false)
  await page.getByRole('button', { name: 'See-through' }).click()
  await changed()
  await page.getByRole('button', { name: 'See-through' }).click()
  await page.getByRole('button', { name: 'Cut open' }).click()
  await changed()
  await page.getByRole('button', { name: 'Cut open' }).click()
  await page.getByRole('slider', { name: 'Take apart' }).focus()
  await page.keyboard.press('End')
  await changed()
  await phase(page, 'Egg')
  await expect(page.getByRole('button', { name: 'See-through' })).toBeDisabled()
})

test('labels name the parts and each opens a sourced explanation', async ({
  page,
}) => {
  await page.goto('./?species=queen-conch')
  await phase(page, 'Adult')
  const parts = page.getByRole('list', { name: 'Labelled parts' })
  for (const name of ['Foot', 'Operculum', 'Eye stalk', 'Aperture'])
    await expect(parts.getByRole('button', { name })).toBeVisible()
  await parts.getByRole('button', { name: 'Operculum' }).click()
  const card = page.getByRole('region', { name: 'Operculum' })
  await expect(card).toContainText('What it’s for')
  await expect(card).toContainText('vault the shell forward')
  // The card opens right beside the label that was tapped.
  const tag = (await parts
    .getByRole('button', { name: 'Operculum' })
    .boundingBox())!
  const box = (await card.boundingBox())!
  const distance = Math.max(
    box.x - (tag.x + tag.width),
    tag.x - (box.x + box.width),
    box.y - (tag.y + tag.height),
    tag.y - (box.y + box.height),
  )
  expect(distance).toBeLessThan(30)
  await card.locator('summary').click()
  await expect(card.getByRole('link').first()).toHaveAttribute(
    'href',
    /^https:/,
  )
  await expect(parts.getByRole('button', { name: 'Columella' })).toBeHidden()
  await page.getByRole('button', { name: 'Cut open' }).click()
  await expect(parts.getByRole('button', { name: 'Columella' })).toBeVisible()
  await page.getByRole('button', { name: 'Labels' }).click()
  await expect(parts).toBeHidden()
})

test('the drawing-to-realistic slider and the views change the figure', async ({
  page,
}) => {
  await page.goto('./?species=textile-cone')
  await phase(page, 'Adult')
  const canvas = page.locator('[data-sim-canvas]')
  const changedFrom = async (before: Buffer) =>
    expect
      .poll(async () => (await canvas.screenshot()).equals(before))
      .toBe(false)
  let before = await canvas.screenshot()
  await page.getByRole('slider', { name: 'Drawing or realistic' }).focus()
  await page.keyboard.press('Home')
  await changedFrom(before)
  before = await canvas.screenshot()
  await page.getByRole('button', { name: 'Front view' }).click()
  await changedFrom(before)
})

test('the ocean floor changes with the species, the place and the reader', async ({
  page,
}) => {
  await page.goto('./?species=queen-conch')
  await phase(page, 'Adult')
  const ocean = page.getByRole('region', { name: 'Ocean floor' })
  await expect(ocean).toHaveAttribute('data-bed', 'seagrass')
  const canvas = page.locator('[data-sim-canvas]')
  let before = await canvas.screenshot()
  await chooseShell(page, 'Chambered nautilus')
  await expect(ocean).toHaveAttribute('data-bed', 'deep')
  await expect(page.locator('.setting-note')).toContainText('Deep reef slope')
  await expect
    .poll(async () => (await canvas.screenshot()).equals(before))
    .toBe(false)
  await chooseShell(page, 'Tiger cowrie')
  await expect(ocean).toHaveAttribute('data-bed', 'coral')
  await choose(page, '#origin', 'hawaiian-islands')
  await expect(page.locator('.setting-note')).toContainText('volcanic rock')
  before = await canvas.screenshot()
  await choose(page, '#seabed', 'kelp')
  await expect(ocean).toHaveAttribute('data-bed', 'kelp')
  await expect(page.locator('.setting-note')).toContainText(
    'not where this species lives',
  )
  await expect
    .poll(async () => (await canvas.screenshot()).equals(before))
    .toBe(false)
  await phase(page, 'Beach')
  await expect(ocean).toHaveAttribute('data-scene', 'beach')
  await phase(page, 'Larva')
  await expect(ocean).toHaveAttribute('data-scene', 'open-water')
})

test('switching place switches the shells to those found there', async ({
  page,
}) => {
  await page.goto('./?species=money-cowrie&place=mauritius')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Money cowrie',
  )
  await choose(page, '#origin', 'bahamas')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Queen conch',
  )
  await expect(page).toHaveURL(/place=bahamas/)
  await page.getByRole('button', { name: 'Shells', exact: true }).click()
  const tray = page.locator('#shell-tray')
  await expect(tray).toContainText('Found at The Bahamas')
  await expect(tray).toContainText('Not recorded at The Bahamas')
  await tray.getByRole('button', { name: /Tiger cowrie/ }).click()
  await choose(page, '#origin', 'hawaiian-islands')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Hawaiian tiger cowrie',
  )
  await expect(page.locator('.sim-taxon')).toContainText('schilderiana')
})

test('the shell menu shows each species as its shell and its animal', async ({
  page,
}) => {
  await page.goto('./?species=money-cowrie')
  const toggle = page.getByRole('button', { name: 'Shells', exact: true })
  await toggle.click()
  const tray = page.locator('#shell-tray')
  await expect(tray.getByRole('button')).toHaveCount(5)
  await expect(
    tray.getByRole('button', { name: /Money cowrie/ }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(tray.locator('.shell-studio img')).toHaveCount(15, {
    timeout: 30000,
  })
  await page.keyboard.press('Escape')
  await expect(tray).toBeHidden()
  await expect(toggle).toBeFocused()
})

test('reset view and zoom to a part', async ({ page }) => {
  await page.goto('./?species=queen-conch')
  await phase(page, 'Adult')
  const canvas = page.locator('[data-sim-canvas]')
  await page
    .getByRole('list', { name: 'Labelled parts' })
    .getByRole('button', { name: 'Operculum' })
    .click()
  const before = await canvas.screenshot()
  await page.getByRole('button', { name: 'Zoom to operculum' }).click()
  await expect
    .poll(async () => (await canvas.screenshot()).equals(before))
    .toBe(false)
  const zoomed = await canvas.screenshot()
  await page.getByRole('button', { name: 'Reset view' }).click()
  await expect
    .poll(async () => (await canvas.screenshot()).equals(zoomed))
    .toBe(false)
})

test('the camera stays above the sea floor and depth follows the sources', async ({
  page,
}) => {
  await page.goto('./?species=tiger-cowrie')
  await expect
    .poll(() => drawn(page), { timeout: 25_000 })
    .toBeGreaterThan(0.02)
  await page.locator('.sim-stage').focus()
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowDown')
  const low = await page.locator('[data-sim-canvas]').screenshot()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  // Already at the lowest angle: further presses change nothing.
  expect(
    (await page.locator('[data-sim-canvas]').screenshot()).equals(low),
  ).toBe(true)
  const depth = page.getByRole('group', { name: 'Depth' })
  await expect(depth).toContainText('Recorded 10–40 m')
  await page.getByRole('slider', { name: 'Depth', exact: true }).focus()
  await page.keyboard.press('End')
  await expect(depth).toContainText('40 m')
  await chooseShell(page, 'Chambered nautilus')
  await expect(depth).toContainText('several hundred metres')
})

test('the scroll wheel, trackpad pinch, keys and buttons zoom the view', async ({
  page,
}) => {
  await page.goto('./?species=queen-conch')
  await expect
    .poll(() => drawn(page), { timeout: 25_000 })
    .toBeGreaterThan(0.02)
  const scale = async () => {
    const width = (await page.locator('.scale-bar span').boundingBox())!.width
    return width / mmOf(await page.locator('.scale-bar').textContent())
  }
  const start = await scale()
  const stage = (await page.locator('[data-sim-canvas]').boundingBox())!
  await page.mouse.move(
    stage.x + stage.width * 0.45,
    stage.y + stage.height * 0.5,
  )
  await page.mouse.wheel(0, -300)
  await expect.poll(scale).toBeGreaterThan(start * 1.2)
  const zoomed = await scale()
  // A trackpad pinch arrives as a wheel event with ctrlKey held.
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, 40)
  await page.keyboard.up('Control')
  await expect.poll(scale).toBeLessThan(zoomed)
  const pinched = await scale()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect.poll(scale).toBeGreaterThan(pinched)
  await page.locator('.sim-stage').focus()
  await page.keyboard.press('Home')
  await expect.poll(scale).toBeCloseTo(start, 1)
  expect(await page.evaluate(() => scrollY)).toBe(0)
})

test('actual size draws the shell at a millimetre scale and can be calibrated', async ({
  page,
}) => {
  await page.goto('./?species=money-cowrie')
  await page.getByRole('button', { name: 'Actual size' }).click()
  await expect(page.locator('.view-badge')).toHaveText('Actual size · estimate')
  const bar = page.locator('.scale-bar span')
  const label = page.locator('.scale-bar')
  const ratio = async () =>
    Math.round(
      ((await bar.boundingBox())!.width / mmOf(await label.textContent())) *
        100,
    ) / 100
  expect(Math.abs((await ratio()) - 96 / 25.4)).toBeLessThan(0.05)
  await page.getByRole('button', { name: 'Calibrate' }).click()
  await page.getByRole('slider', { name: 'Card width on screen' }).fill('5')
  await page.getByRole('button', { name: 'Use this size' }).click()
  await expect(page.locator('.view-badge')).toHaveText('Actual size')
  await expect.poll(ratio).toBe(5)
  await page.reload()
  await page.getByRole('button', { name: 'Actual size' }).click()
  await expect(page.locator('.view-badge')).toHaveText('Actual size')
})

test('durations are sourced or plainly marked as not established', async ({
  page,
}) => {
  await page.goto('./?species=queen-conch')
  await expect(page.locator('.durations')).toContainText('21–30 days')
  await expect(page.locator('.durations')).toContainText('25–30 years')
  await chooseShell(page, 'Money cowrie')
  await expect(page.locator('.durations')).toContainText('Not established')
  await phase(page, 'Adult')
  await expect(page.locator('.clock')).toContainText('not established')
  const evidence = page.locator('.life-panel .fact details').first()
  await evidence.locator('summary').click()
  await expect(evidence.locator('a').first()).toHaveAttribute(
    'href',
    /^https:\/\//,
  )
})

test('sources dialog opens, lists HTTPS sources and closes from the keyboard', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Sources' }).click()
  const dialog = page.getByRole('dialog', { name: 'Sources and uncertainty' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('NOAA Fisheries')
  await expect(dialog).toContainText('WoRMS')
  const links = await dialog
    .locator('a')
    .evaluateAll((items) => items.map((item) => item.getAttribute('href')))
  for (const href of links) expect(href).toMatch(/^https:\/\//)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('the stage turns from the keyboard and the timeline is keyboard operable', async ({
  page,
}) => {
  await page.goto('./?species=tiger-cowrie')
  const canvas = page.locator('[data-sim-canvas]')
  await expect
    .poll(() => drawn(page), { timeout: 25_000 })
    .toBeGreaterThan(0.02)
  await page.locator('.sim-stage').focus()
  const before = await canvas.screenshot()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect
    .poll(async () => (await canvas.screenshot()).equals(before))
    .toBe(false)
  await page.getByRole('slider', { name: 'Life timeline' }).focus()
  await page.keyboard.press('Home')
  await expect(page.locator('#phase-title')).toHaveText('Egg')
  await page.keyboard.press('End')
  await expect(page.locator('#phase-title')).toHaveText('Found')
})

test('light and dark appearance both keep text readable', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.goto(`./?scoutTheme=${scheme}`)
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme)
    for (const selector of ['.life-panel h2', '.fact p', '.durations dt']) {
      const ratio = await page
        .locator(selector)
        .first()
        .evaluate((element) => {
          const rgb = (value: string) =>
            value
              .match(/\d+(\.\d+)?/g)!
              .slice(0, 3)
              .map(Number)
          const lum = (value: string) => {
            const [r, g, b] = rgb(value).map((c) => {
              const v = c / 255
              return v <= 0.03928
                ? v / 12.92
                : Math.pow((v + 0.055) / 1.055, 2.4)
            })
            return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
          }
          const fg = lum(getComputedStyle(element).color)
          const bg = lum(getComputedStyle(document.body).backgroundColor)
          return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
        })
      expect(ratio, `${scheme} ${selector}`).toBeGreaterThan(4.5)
    }
  }
})

for (const width of [320, 390]) {
  test(`the simulator fits a ${width} CSS pixel phone`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('./?species=queen-conch')
    await expect(page.locator('[data-sim-canvas]')).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await expect(page.locator('.action-button')).toBeVisible()
  })
}

test('WebGL failure keeps the timeline, facts and sources working', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (type === 'webgl' || type === 'webgl2') return null
      return Reflect.apply(original, this, [type, ...args])
    }
  })
  await page.goto('./?species=queen-conch')
  await expect(page.getByText(/3D is unavailable/)).toBeVisible()
  await phase(page, 'Found')
  await expect(page.locator('#phase-title')).toHaveText('Found')
  await page.getByRole('button', { name: 'Sources' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('the production build works offline after its first visit', async ({
  page,
  context,
}) => {
  await page.goto('./')
  await expect(page.getByText('Offline ready', { exact: true })).toBeVisible({
    timeout: 15000,
  })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await context.setOffline(true)
  try {
    await page.reload()
    await expect(page.locator('[data-sim-canvas]')).toBeVisible()
    await chooseShell(page, 'Chambered nautilus')
    await phase(page, 'Empty shell')
    await page.getByRole('button', { name: 'Let it drift' }).click()
    await expect(announced(page)).toContainText('float')
  } finally {
    if (!page.isClosed()) await context.setOffline(false)
  }
})

test('where it is found: every ocean, recorded places as origins, flagged outliers', async ({
  page,
}) => {
  await page.goto('./?species=queen-conch')
  const where = page.locator('.where')
  await expect(where).toContainText('Caribbean & Western Atlantic')
  await expect(where).toContainText('Indian Ocean & Red Sea')
  const origin = page.locator('#origin')
  await expect(origin).not.toHaveAttribute('data-value', 'red-sea')
  await where.getByRole('button', { name: /^The Bahamas/ }).click()
  await expect(origin).toHaveAttribute('data-value', 'bahamas')
  await expect(announced(page)).toContainText('The Bahamas')
  await expect(
    where.getByRole('button', { name: /^Philippines/ }),
  ).toHaveAttribute('data-outside', 'true')
  await expect(
    where.getByRole('button', { name: /^Madagascar/ }),
  ).toBeDisabled()
  await chooseShell(page, 'Chambered nautilus')
  await expect(where.locator('[aria-pressed="true"]')).toContainText(
    'Great Barrier Reef',
  )
  const evidence = where.locator('.fact details').first()
  await evidence.locator('summary').click()
  await expect(evidence).toContainText('GBIF')
})

test('the shell lab builds shells from the published model and responds to its numbers', async ({
  page,
}) => {
  await page.goto('./')
  const lab = page.locator('.lab')
  await lab.scrollIntoViewIfNeeded()
  const view = lab.locator('.lab-view canvas')
  await expect(view).toBeVisible()
  await lab.getByRole('button', { name: /^Nautilus/ }).click()
  await expect(lab).toContainText('as published in Table 1')
  const before = await view.screenshot()
  await lab.getByRole('slider', { name: /Spire height/ }).fill('3')
  await expect(lab).toContainText('Your own shell')
  await expect
    .poll(async () => (await view.screenshot()).equals(before))
    .toBe(false)
  await lab.getByRole('button', { name: /Reset to nautilus/ }).click()
  await expect(lab).toContainText('as published in Table 1')
  await lab.getByRole('button', { name: /^Scallop/ }).click()
  await expect(lab).toContainText('not taken from the paper')
})

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('the living animal slowly makes its way over the sea floor', async ({
    page,
  }) => {
    await page.goto('./?species=queen-conch')
    const canvas = page.locator('[data-sim-canvas]')
    await expect(canvas).toHaveAttribute('data-crawl', 'moving', {
      timeout: 25_000,
    })
    // It rests while it hides in its shell, and sets off again.
    await page.getByRole('button', { name: 'Poke it' }).click()
    await expect(canvas).toHaveAttribute('data-crawl', 'resting')
    await expect(canvas).toHaveAttribute('data-crawl', 'moving')
    // It waits while a part is being read.
    const parts = page.getByRole('list', { name: 'Labelled parts' })
    await parts.getByRole('button', { name: 'Operculum' }).click()
    await expect(canvas).toHaveAttribute('data-crawl', 'resting')
    // An empty shell stays put.
    await phase(page, 'Empty shell')
    await expect(canvas).not.toHaveAttribute('data-crawl')
  })
})
