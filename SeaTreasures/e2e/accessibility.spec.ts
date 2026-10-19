import { test, expect } from '@playwright/test'

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} small text meets 4.5:1 contrast against its actual page surface`, async ({
    page,
  }) => {
    await page.goto(`./?scoutTheme=${theme}`)
    const ratio = await page.locator('.intro-copy').evaluate((element) => {
      const values = (color: string) => {
        const matches = color.match(/[\d.]+/g)
        if (!matches || matches.length < 3)
          throw new Error(`Unexpected computed color: ${color}`)
        return matches
          .slice(0, 3)
          .map(Number)
          .map((part) => {
            const value = part / 255
            return value <= 0.04045
              ? value / 12.92
              : Math.pow((value + 0.055) / 1.055, 2.4)
          })
      }
      const luminance = (color: string) => {
        const [r, g, b] = values(color)
        return r * 0.2126 + g * 0.7152 + b * 0.0722
      }
      const text = luminance(getComputedStyle(element).color)
      const surface = luminance(getComputedStyle(document.body).backgroundColor)
      return (Math.max(text, surface) + 0.05) / (Math.min(text, surface) + 0.05)
    })
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
}

test('on an iPhone-sized viewport the shell stays visible while its stage and size controls are used', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('./')
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Growth & time', exact: true })
    .click()
  for (const name of [
    'Move through growth stages',
    'Adult reference length',
    'Move through growth stages',
  ]) {
    const control = page.getByRole('slider', { name })
    await control.scrollIntoViewIfNeeded()
    await control.focus()
    await control.press('End')
    const canvas = await page.locator('[data-shell-canvas]').boundingBox()
    const slider = await control.boundingBox()
    expect(canvas).not.toBeNull()
    expect(slider).not.toBeNull()
    if (!canvas || !slider)
      throw new Error('The model or its slider is missing.')
    expect(canvas.y).toBeGreaterThanOrEqual(0)
    expect(canvas.y + canvas.height).toBeLessThanOrEqual(slider.y)
    expect(slider.y + slider.height).toBeLessThanOrEqual(812 - 88)
  }
})
