import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  // The ocean fills the window and headless browsers draw it in software: give each test room.
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5175/seatreasures/',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/webkit.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--enable-unsafe-swiftshader'] },
      },
    },
    {
      name: 'webkit',
      testMatch: '**/webkit.spec.ts',
      use: { ...devices['iPhone 13'], browserName: 'webkit' },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175/seatreasures/',
    reuseExistingServer: !process.env.CI,
  },
})
