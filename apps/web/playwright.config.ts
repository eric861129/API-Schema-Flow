import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-1366',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
})
