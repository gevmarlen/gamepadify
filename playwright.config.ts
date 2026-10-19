import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 20_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: { command: 'npm exec vite -- --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173/tests/browser/fixture.html', reuseExistingServer: !process.env.CI },
});
