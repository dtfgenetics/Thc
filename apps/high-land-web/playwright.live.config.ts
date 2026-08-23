import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-live',
  timeout: 180_000,
  expect: {
    timeout: 20_000
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'https://dtfseeds.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 45_000,
    actionTimeout: 20_000
  },
  projects: [
    { name: 'chromium-live', use: { ...devices['Desktop Chrome'] } }
  ]
});
