import { defineConfig, devices } from '@playwright/test'
import { loadEnvFile } from 'node:process'

try {
  loadEnvFile('.env')
} catch {
  /* no .env file */
}

process.env.MOCKSERVER_HOST ??= 'localhost'
process.env.MOCKSERVER_PORT ??= '1080'
process.env.GRANTS_UI_BACKEND_AUTH_TOKEN ??= 'auth_token'
process.env.GRANTS_UI_BACKEND_ENCRYPTION_KEY ??= 'encryption_key'
process.env.BASE_BACKEND_URL ??= 'http://localhost:3001'
process.env.MONGO_URI ??= 'mongodb://127.0.0.1:27017/?directConnection=true'

export default defineConfig({
  testDir: './test/specs',
  testMatch: '**/*.spec.js',
  grep: /@runme/,
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['html', { open: 'on-failure', outputFolder: 'playwright-report' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    headless: false,
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
