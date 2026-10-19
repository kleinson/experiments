import { test, expect } from '@playwright/test'

for (const width of [320, 375, 430, 768, 1280]) {
  test(`complete story reflows at ${width} CSS pixels`, async ({ page }) => {
    const errors: string[] = []
    const failed: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('requestfailed', (request) => failed.push(request.url()))
    await page.setViewportSize({ width, height: 900 })
    await page.goto('./')
    for (const name of [
      'Discover',
      'Meet',
      'The builder',
      'Growth & time',
      'What remains',
    ]) {
      await page
        .getByRole('navigation')
        .getByRole('button', { name, exact: true })
        .click()
      await expect(page.locator('h1')).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      expect(await page.evaluate(() => innerWidth)).toBe(width)
    }
    await page.getByRole('button', { name: 'Sources & uncertainty' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.getByRole('button', { name: 'Close evidence library' }).click()
    expect(errors).toEqual([])
    expect(failed).toEqual([])
  })
}

test('the five-moment journey manipulates a rendered shell and saves a real local record', async ({
  page,
}) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A life, left behind.',
  )
  await page.getByRole('button', { name: 'Open demo specimen' }).click()
  await expect(
    page.getByRole('heading', { name: 'Hawaiian tiger cowrie', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('Selected specimen · no identification score'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Meet the living builder' }).click()
  const canvas = page.locator('[data-shell-canvas]')
  await expect(canvas).toBeVisible()
  await page
    .getByRole('slider', { name: 'Let the mantle cover the shell' })
    .fill('0')
  const bare = await canvas.screenshot()
  await page
    .getByRole('slider', { name: 'Let the mantle cover the shell' })
    .fill('100')
  await expect
    .poll(async () => (await canvas.screenshot()).equals(bare))
    .toBe(false)
  await page.getByRole('button', { name: 'Explore its growth' }).click()
  await expect(
    page.getByRole('slider', { name: 'Move through growth stages' }),
  ).toHaveValue('0')
  const juvenile = await canvas.screenshot()
  await page.getByRole('button', { name: 'Mature adult', exact: true }).click()
  await expect(
    page.getByRole('slider', { name: 'Move through growth stages' }),
  ).toHaveValue('100')
  await expect
    .poll(async () => (await canvas.screenshot()).equals(juvenile))
    .toBe(false)
  await page.getByRole('button', { name: '150 mm', exact: true }).click()
  await expect(
    page.getByRole('slider', { name: 'Adult reference length' }),
  ).toHaveValue('150')
  await expect(page.getByText('How old? We can’t tell you that.')).toBeVisible()
  await page.getByRole('button', { name: 'Top', exact: true }).click()
  const top = await canvas.screenshot()
  await page.getByRole('button', { name: 'Underside', exact: true }).click()
  await expect
    .poll(async () => (await canvas.screenshot()).equals(top))
    .toBe(false)
  await page.getByRole('button', { name: 'Read the rest of its story' }).click()
  await page
    .getByRole('checkbox', { name: 'Inspect an illustrated repair' })
    .check()
  await expect(page.getByText(/hypothetical mark, not evidence/)).toBeVisible()
  await page
    .getByRole('textbox', { name: /Your field note/ })
    .fill('The shell was made by a living animal.')
  const beforeSave = Date.now()
  await page.getByRole('button', { name: 'Save to my collection' }).click()
  await expect(page.getByText('One story in your collection.')).toBeVisible()
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('shell-remembers.collection.v1') ?? 'null'),
  )
  expect(saved.lengthMm).toBe(150)
  expect(saved.note).toBe('The shell was made by a living animal.')
  expect(Date.parse(saved.savedAt)).toBeGreaterThanOrEqual(beforeSave)
  expect(Date.parse(saved.savedAt)).toBeLessThanOrEqual(Date.now())
  expect(saved).not.toHaveProperty('age')
  await page.reload()
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'What remains', exact: true })
    .click()
  await expect(
    page.getByRole('textbox', { name: /Your field note/ }),
  ).toHaveValue(saved.note)
  await expect(page.getByText('One story in your collection.')).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Remove saved specimen', exact: true })
    .click()
  await expect(page.getByText('One story in your collection.')).toHaveCount(0)
  expect(
    await page.evaluate(() =>
      localStorage.getItem('shell-remembers.collection.v1'),
    ),
  ).toBeNull()
})

test('every growth stage retains visible underside geometry rather than an empty changed canvas', async ({
  page,
}) => {
  await page.goto('./')
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Growth & time', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Underside', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  for (const value of ['0', '25', '50', '75', '100']) {
    await page
      .getByRole('slider', { name: 'Move through growth stages' })
      .fill(value)
    await expect
      .poll(async () => {
        const png = (
          await page.locator('[data-shell-canvas]').screenshot()
        ).toString('base64')
        return page.evaluate(async (data) => {
          const image = new Image()
          image.src = `data:image/png;base64,${data}`
          await image.decode()
          const canvas = document.createElement('canvas')
          canvas.width = image.naturalWidth
          canvas.height = image.naturalHeight
          const context = canvas.getContext('2d')
          if (!context)
            throw new Error('The screenshot decoder is unavailable.')
          context.drawImage(image, 0, 0)
          const pixels = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          ).data
          let foreground = 0
          for (let i = 0; i < pixels.length; i += 4) {
            const difference =
              Math.abs(pixels[i] - pixels[0]) +
              Math.abs(pixels[i + 1] - pixels[1]) +
              Math.abs(pixels[i + 2] - pixels[2])
            if (difference > 96) foreground++
          }
          return foreground / (pixels.length / 4)
        }, png)
      })
      .toBeGreaterThan(0.01)
  }
})

test('keyboard-only controls, focus transitions and source dialog work', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Open demo specimen' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('h1')).toBeFocused()
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Growth & time', exact: true })
    .focus()
  await page.keyboard.press('Enter')
  const slider = page.getByRole('slider', {
    name: 'Move through growth stages',
  })
  await slider.focus()
  await page.keyboard.press('End')
  await expect(slider).toHaveValue('100')
  await page.keyboard.press('Home')
  await expect(slider).toHaveValue('0')
  const model = page.getByRole('group', { name: /^Turn the shell/ })
  await model.focus()
  const before = await page.locator('[data-shell-canvas]').screenshot()
  await page.keyboard.press('ArrowRight')
  await expect
    .poll(async () =>
      (await page.locator('[data-shell-canvas]').screenshot()).equals(before),
    )
    .toBe(false)
  await page.getByRole('button', { name: 'Sources & uncertainty' }).focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('button', { name: 'Close evidence library' }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Sources & uncertainty' }),
  ).toBeFocused()
})

test('reduced motion remains interactive and does not animate at rest', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')
  const canvas = page.locator('[data-shell-canvas]')
  await expect(canvas).toBeVisible()
  const first = await canvas.screenshot()
  await page.waitForTimeout(350)
  const second = await canvas.screenshot()
  expect(first.equals(second)).toBe(true)
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Growth & time', exact: true })
    .click()
  await page.getByRole('button', { name: 'Subadult', exact: true }).click()
  await expect(
    page.getByRole('slider', { name: 'Move through growth stages' }),
  ).toHaveValue('50')
  const transitions = await page
    .getByRole('button', { name: 'Subadult', exact: true })
    .evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(transitions).toBe('0s')
})

test('light and dark themes follow system, query override and actual toggle', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('./')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.goto('./?scoutTheme=light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('a corrupted save is disclosed and is not silently overwritten', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('shell-remembers.collection.v1', '{damaged'),
  )
  await page.goto('./')
  await expect(page.getByRole('alert')).toContainText(
    'Nothing has been overwritten',
  )
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'What remains', exact: true })
    .click()
  await page.getByRole('button', { name: 'Save to my collection' }).click()
  expect(
    await page.evaluate(() =>
      localStorage.getItem('shell-remembers.collection.v1'),
    ),
  ).toBe('{damaged')
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: 'Remove unreadable local save' })
    .click()
  await page.getByRole('button', { name: 'Save to my collection' }).click()
  await expect(page.getByText('One story in your collection.')).toBeVisible()
})

test('denied storage produces an explicit error without blocking exploration', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage denied', 'SecurityError')
    }
  })
  await page.goto('./')
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'What remains', exact: true })
    .click()
  await page.getByRole('button', { name: 'Save to my collection' }).click()
  await expect(page.getByRole('alert')).toContainText('Saving is unavailable')
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Growth & time', exact: true })
    .click()
  await page.getByRole('button', { name: 'Mature adult', exact: true }).click()
  await expect(
    page.getByRole('slider', { name: 'Move through growth stages' }),
  ).toHaveValue('100')
})

test('WebGL failure keeps the complete journey and responsive illustrated model', async ({
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

  await page.goto('./')
  await expect(
    page.getByText('3D is unavailable here.', { exact: false }),
  ).toBeVisible()
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Growth & time', exact: true })
    .click()
  await page.getByRole('button', { name: 'Mature adult', exact: true }).click()
  await expect(
    page.getByRole('slider', { name: 'Move through growth stages' }),
  ).toHaveValue('100')
  await expect(page.locator('.has-fallback .shell-fallback')).toBeVisible()
  await page.getByRole('button', { name: 'Read the rest of its story' }).click()
  await page.getByRole('button', { name: 'Save to my collection' }).click()
  await expect(page.getByText('One story in your collection.')).toBeVisible()
})

test('losing a running graphics context preserves the selected stage and collection journey', async ({
  page,
}) => {
  await page.goto('./')
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Growth & time', exact: true })
    .click()
  await page.getByRole('button', { name: 'Subadult', exact: true }).click()
  await page.locator('[data-shell-canvas]').evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement))
      throw new Error('The model canvas is missing.')
    const extension = element
      .getContext('webgl2')
      ?.getExtension('WEBGL_lose_context')
    if (!extension)
      throw new Error('The context-loss test extension is unavailable.')
    extension.loseContext()
  })
  await expect(page.getByText(/3D was interrupted/)).toBeVisible()
  await expect(
    page.getByRole('slider', { name: 'Move through growth stages' }),
  ).toHaveValue('50')
  await page.getByRole('button', { name: 'Mature adult', exact: true }).click()
  await expect(page.locator('.has-fallback .shell-fallback')).toBeVisible()
  await page.getByRole('button', { name: 'Read the rest of its story' }).click()
  await page.getByRole('button', { name: 'Save to my collection' }).click()
  await expect(page.getByText('One story in your collection.')).toBeVisible()
})

test('visible size comparisons honor exact reference boundaries without assigning an age', async ({
  page,
}) => {
  await page.goto('./')
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Growth & time', exact: true })
    .click()
  const length = page.getByRole('slider', { name: 'Adult reference length' })
  for (const [value, title] of [
    ['125', 'An adult reference, in perspective.'],
    ['126', 'Large against this field reference.'],
    ['149', 'Large against this field reference.'],
    ['150', 'Close to the reported upper end.'],
    ['153', 'Close to the reported upper end.'],
    ['154', 'Beyond this reference’s reported maximum.'],
  ] as const) {
    await length.fill(value)
    await expect(page.locator('.size-readout h2')).toHaveText(title)
    await expect(
      page.getByText('How old? We can’t tell you that.'),
    ).toBeVisible()
  }
  await length.fill('150')
  await expect(page.locator('.size-readout p')).toContainText('3 mm below')
  await expect(
    page.getByRole('slider', { name: 'Move through growth stages' }),
  ).toHaveValue('0')
})

test('200 percent layout zoom preserves controls without horizontal page overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('./')
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2'
  })
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Growth & time', exact: true })
    .click()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: '150 mm', exact: true }).click()
  await expect(
    page.getByRole('slider', { name: 'Adult reference length' }),
  ).toHaveValue('150')
})

test('production journey, sources, model and local collection work after going offline', async ({
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
    await page.getByRole('button', { name: 'Open demo specimen' }).click()
    await page.getByRole('button', { name: 'Meet the living builder' }).click()
    await expect(page.locator('[data-shell-canvas]')).toBeVisible()
    await page.getByRole('button', { name: 'Explore its growth' }).click()
    await page
      .getByRole('button', { name: 'Mature adult', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Read the rest of its story' })
      .click()
    await page.getByRole('button', { name: 'Save to my collection' }).click()
    await expect(page.getByText('One story in your collection.')).toBeVisible()
    await page.getByRole('button', { name: 'Sources & uncertainty' }).click()
    await expect(page.getByRole('dialog')).toContainText('MolluscaBase')
  } finally {
    if (!page.isClosed()) await context.setOffline(false)
  }
})
