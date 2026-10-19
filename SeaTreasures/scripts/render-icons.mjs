import { readFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const svg = await readFile(
  new URL('../public/shell-mark.svg', import.meta.url),
  'utf8',
)
const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    colorScheme: 'light',
    deviceScaleFactor: 1,
  })
  await page.setContent(
    `<style>html,body{margin:0;background:var(--cp-bg)}svg{display:block;width:100vw;height:100vh}</style>${svg}`,
  )
  const publicDirectory = new URL('../public/', import.meta.url)
  for (const size of [180, 192, 512]) {
    await page.setViewportSize({ width: size, height: size })
    await page.screenshot({
      path: fileURLToPath(new URL(`shell-icon-${size}.png`, publicDirectory)),
    })
  }
  const nativeDirectory = new URL(
    '../ios/App/Assets.xcassets/AppIcon.appiconset/',
    import.meta.url,
  )
  await mkdir(nativeDirectory, { recursive: true })
  await page.setViewportSize({ width: 1024, height: 1024 })
  await page.screenshot({
    path: fileURLToPath(new URL('AppIcon.png', nativeDirectory)),
  })
  console.info('Rendered web and iOS icons from original shell-mark.svg.')
} finally {
  await browser.close()
}
