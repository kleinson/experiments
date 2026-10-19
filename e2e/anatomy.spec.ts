import { expect, test } from '@playwright/test'

test.use({ reducedMotion: 'reduce' })

test('the see-through plate highlights parts and opens the shell to show organs', async ({
  page,
}) => {
  await page.goto('./')
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'The builder', exact: true })
    .click()
  const plate = page.locator('#plate-cutaway')
  await expect(plate.getByText('The animal inside')).toBeVisible()
  await expect(plate.locator('[data-corner="hint"]')).toHaveText(
    'Tap a part · ← →',
  )
  await page.getByRole('button', { name: 'Heart', exact: true }).click()
  await expect(plate.locator('[data-corner="readout"]')).toHaveText('Heart')
  await expect(plate.locator('style')).toContainText('[data-part="heart"]')
  await expect(page.locator('.an-note')).toContainText('visceral mass')
  await expect(page.locator('.an-note')).toContainText('confidence')
  await expect(plate.locator('[data-part="heart"]').first()).toBeAttached()

  const open = page.getByRole('slider', { name: 'See inside' })
  await open.fill('0')
  await expect(plate.locator('[data-part="gill"]')).toHaveCount(0)
  await expect(plate.locator('.an-cut')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Gill (ctenidium)', exact: true })
    .click()
  await expect(open).toHaveValue('85')
  await expect(plate.locator('[data-part="gill"]').first()).toBeAttached()
  await expect(plate.locator('.an-cut').first()).toBeAttached()

  await plate.locator('.iso-plate').focus()
  await page.keyboard.press('ArrowRight')
  await expect(plate.locator('[data-corner="readout"]')).toHaveText(
    'Osphradium',
  )
})

test('the mantle coverage set by the builder control is drawn in the cutaway', async ({
  page,
}) => {
  await page.goto('./')
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'The builder', exact: true })
    .click()
  const plate = page.locator('#plate-cutaway')
  await expect(plate.locator('[data-part="mantle"]').first()).toBeAttached()
  await page
    .getByRole('slider', { name: 'Let the mantle cover the shell' })
    .fill('0')
  await expect(plate.locator('[data-part="mantle"]')).toHaveCount(0)
})

test('the specimen drawer and the growth control stay one model', async ({
  page,
}) => {
  await page.goto('./')
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Growth & time', exact: true })
    .click()
  const drawer = page.locator('#plate-drawer')
  const growth = page.getByRole('slider', {
    name: 'Move through growth stages',
  })
  await expect(drawer.locator('[data-corner="readout"]')).toContainText(
    'Juvenile',
  )
  await drawer.locator('.an-hit').nth(2).click({ force: true })
  await expect(growth).toHaveValue('50')
  await expect(drawer.locator('[data-corner="readout"]')).toContainText(
    'Subadult',
  )
  await expect(drawer.locator('style')).toContainText('stage-2')
  await drawer.locator('.iso-plate').focus()
  await page.keyboard.press('ArrowRight')
  await expect(growth).toHaveValue('100')
  await page.getByRole('button', { name: 'Developing', exact: true }).click()
  await expect(drawer.locator('[data-corner="readout"]')).toContainText(
    'Developing',
  )
})

test('the shell wall plate lays down its newest coat and states its composition', async ({
  page,
}) => {
  await page.goto('./')
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Growth & time', exact: true })
    .click()
  const wall = page.locator('#plate-wall')
  await expect(wall.locator('[data-corner="readout"]')).toHaveText(
    'Newest coat complete',
  )
  const coat = page.getByRole('slider', { name: 'Lay down the newest coat' })
  await coat.fill('0')
  await expect(wall.locator('[data-corner="readout"]')).toHaveText(
    'Newest coat not yet laid',
  )
  await expect(wall.locator('.an-spot')).toHaveCount(0)
  await coat.fill('50')
  await expect(wall.locator('[data-corner="readout"]')).toHaveText(
    'Newest coat 50% laid',
  )
  await expect(wall).toContainText('1–5% by weight')
  await expect(wall).toContainText('not a measured cowrie microstructure')
})

test.describe('with motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' })
  test('an idle tour visits parts and stops when the reader takes over', async ({
    page,
  }) => {
    await page.goto('./')
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'The builder', exact: true })
      .click()
    const plate = page.locator('#plate-cutaway')
    await plate.scrollIntoViewIfNeeded()
    await page.mouse.move(2, 2)
    await expect(plate.locator('[data-corner="hint"]')).toContainText('Touring')
    await expect(plate.locator('[data-corner="readout"]')).not.toHaveText(
      'Mantle lobes',
      {
        timeout: 6000,
      },
    )
    await page.getByRole('button', { name: 'Kidney', exact: true }).click()
    await expect(plate.locator('[data-corner="hint"]')).toHaveText(
      'Tap a part · ← →',
    )
    await page.waitForTimeout(3200)
    await expect(plate.locator('[data-corner="readout"]')).toHaveText('Kidney')
  })
})

for (const width of [320, 390]) {
  test(`anatomy plates fit a ${width} CSS pixel phone`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('./')
    for (const moment of ['The builder', 'Growth & time']) {
      await page
        .getByRole('navigation')
        .getByRole('button', { name: moment, exact: true })
        .click()
      await expect(page.locator('.an-figure').first()).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
    }
  })
}
