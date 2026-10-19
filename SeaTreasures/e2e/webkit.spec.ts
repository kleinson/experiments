import { test, expect } from '@playwright/test'

for (const width of [320, 375, 430]) {
  test(`WebKit touch journey works at ${width} CSS pixels`, async ({
    page,
  }) => {
    const errors: string[] = []
    const failed: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('requestfailed', (request) => failed.push(request.url()))
    await page.setViewportSize({ width, height: 812 })
    await page.goto('./')
    await page.getByRole('button', { name: 'Open demo specimen' }).tap()
    await expect(
      page.getByText('Selected specimen · no identification score'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Meet the living builder' }).tap()
    await page
      .getByRole('slider', { name: 'Let the mantle cover the shell' })
      .fill('100')
    await page.getByRole('button', { name: 'Explore its growth' }).tap()
    await page.getByRole('button', { name: 'Mature adult', exact: true }).tap()
    await page.getByRole('button', { name: '150 mm', exact: true }).tap()
    await expect(page.locator('.size-readout p')).toContainText('3 mm below')
    await expect(
      page.getByText('How old? We can’t tell you that.'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Read the rest of its story' }).tap()
    await page
      .getByRole('textbox', { name: /Your field note/ })
      .fill('A story, not a birthday.')
    await page.getByRole('button', { name: 'Save to my collection' }).tap()
    await expect(page.getByText('One story in your collection.')).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    expect(await page.evaluate(() => innerWidth)).toBe(width)
    await page.getByRole('button', { name: 'Sources & uncertainty' }).tap()
    await expect(page.getByRole('dialog')).toContainText('MolluscaBase')
    await page.getByRole('button', { name: 'Close evidence library' }).tap()
    expect(errors).toEqual([])
    expect(failed).toEqual([])
  })
}

test('WebKit honors dark appearance and reduced motion', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('./')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Switch to light mode' }).tap()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Growth & time', exact: true })
    .tap()
  await page.getByRole('button', { name: 'Subadult', exact: true }).tap()
  await expect(
    page.getByRole('slider', { name: 'Move through growth stages' }),
  ).toHaveValue('50')
})

test('WebKit can reopen its cached specimen offline', async ({
  page,
  context,
}) => {
  await page.goto('./')
  await expect(page.getByText('Offline ready', { exact: true })).toBeVisible({
    timeout: 15000,
  })
  await context.setOffline(true)
  try {
    await page.reload()
    await page.getByRole('button', { name: 'Open demo specimen' }).tap()
    await page.getByRole('button', { name: 'Meet the living builder' }).tap()
    await expect(
      page.getByRole('slider', { name: 'Let the mantle cover the shell' }),
    ).toBeVisible()
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'What remains', exact: true })
      .tap()
    await page.getByRole('button', { name: 'Save to my collection' }).tap()
    await expect(page.getByText('One story in your collection.')).toBeVisible()
  } finally {
    if (!page.isClosed()) await context.setOffline(false)
  }
})
