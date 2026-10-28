import { defineConfig, devices } from '@playwright/test';

// Browser tests for the basic features, with Web NFC simulated (e2e/nfc.js).
// Runs against the production build, on a phone-sized Chrome.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone-light', use: { colorScheme: 'light' } },
    { name: 'phone-dark', use: { colorScheme: 'dark' }, testMatch: /create\.spec/ },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
