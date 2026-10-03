import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/specs',
  testMatch: '**/*.spec.js',
  grep: /@ci/,
  timeout: 120_000,
  fullyParallel: false,
  workers: parseInt(process.env.MAX_INSTANCES) || 1,
  reporter: [['list', { printSteps: true }]],
  use: {
    baseURL: process.env.BASE_URL,
    headless: true,
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
