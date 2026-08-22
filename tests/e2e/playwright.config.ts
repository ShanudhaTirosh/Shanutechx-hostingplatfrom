import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against a locally-running dashboard (npm run dev:dashboard)
 * pointed at a real API + test database. These are NOT run in CI yet —
 * they need a seeded test database and a running Firebase Auth emulator,
 * neither of which exists in this repo yet. See tests/e2e/README.md for
 * what's needed to actually turn these on.
 */
export default defineConfig({
  testDir: './',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
