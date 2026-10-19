import { expect, test } from '@playwright/test'

for (const width of [320, 375, 430]) {
  test(`WebKit touch life works at ${width} CSS pixels`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 812 })
    await page.goto('./?species=queen-conch')
    await expect(page.locator('[data-sim-canvas]')).toBeVisible()
    await page.locator('.phase-ticks button', { hasText: 'Egg' }).tap()
    await page.getByRole('button', { name: 'Hatch them all' }).tap()
    await expect(page.locator('#phase-title')).toHaveText('Larva')
    await page.getByRole('button', { name: 'Let it settle' }).tap()
    await expect(page.locator('#phase-title')).toHaveText('Growing')
    await page.locator('.phase-ticks button', { hasText: 'Found' }).tap()
    await page.getByRole('button', { name: 'Pick it up' }).tap()
    await expect(page.getByRole('list', { name: 'Your shelf' })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.getByRole('button', { name: 'Sources' }).tap()
    await expect(page.getByRole('dialog')).toContainText('NOAA Fisheries')
    await page.getByRole('button', { name: 'Close sources' }).tap()
    expect(errors).toEqual([])
  })
}

test('WebKit honours dark appearance and reduced motion', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('./')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Switch to light mode' }).tap()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('WebKit reopens the simulator offline', async ({ page, context }) => {
  await page.goto('./')
  await expect(page.getByText('Offline ready', { exact: true })).toBeVisible({
    timeout: 15000,
  })
  await context.setOffline(true)
  try {
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.getByRole('button', { name: /Textile cone/ }).tap()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Textile cone',
    )
  } finally {
    if (!page.isClosed()) await context.setOffline(false)
  }
})
