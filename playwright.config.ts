import { defineConfig } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT) || 8787
const BASE_URL = `http://127.0.0.1:${PORT}`
const forceFreshServer = process.env.CEPHEUS_E2E_FRESH_SERVER === '1'
const reuseExistingServer =
  process.env.CEPHEUS_E2E_REUSE_EXISTING_SERVER === '1'
const persistDir = '.tmp/wrangler-e2e'
const devServerCommand = [
  'npx wrangler d1 migrations apply cepheus-online-private-beta',
  '--local',
  `--persist-to ${persistDir}`,
  '&&',
  'npm run build:client &&',
  'wrangler dev',
  `--port ${PORT}`,
  '--local',
  `--persist-to ${persistDir}`,
  '--var SESSION_SECRET:e2e-session-secret',
  '--var DISCORD_CLIENT_ID:e2e-discord-client',
  '--var DISCORD_CLIENT_SECRET:e2e-discord-secret',
  `--var APP_BASE_URL:${BASE_URL}`,
  '--log-level error',
  '--show-interactive-dev-session=false'
].join(' ')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  outputDir: '.tmp/playwright-results',
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { open: 'never', outputFolder: '.tmp/playwright-report' }]
      ]
    : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: devServerCommand,
    url: BASE_URL,
    reuseExistingServer:
      reuseExistingServer && !process.env.CI && !forceFreshServer,
    timeout: 120_000
  }
})
