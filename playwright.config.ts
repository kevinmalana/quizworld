import { defineConfig } from '@playwright/test';

// Local fixture URLs never inherit BASE_URL (which CI points at production).
export const localFixtureURL = process.env.LOCAL_FIXTURE_BASE_URL || 'http://127.0.0.1:3000';
const localURL = new URL(localFixtureURL);
if (localURL.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(localURL.hostname)
    || localURL.username || localURL.password || localURL.pathname !== '/' || localURL.search || localURL.hash) {
  throw new Error('LOCAL_FIXTURE_BASE_URL must be an HTTP loopback origin');
}
const localFixtures = ['**/navigation-boundaries.spec.ts', '**/ux-polish.spec.ts'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  // Only the allowlisted JSON summary is published from CI (not HTML/traces).
  reporter: process.env.CI
    ? [['list'], ['./scripts/e2e-evidence-reporter.cjs']]
    : 'html',
  use: {
    baseURL: process.env.BASE_URL || 'https://www.quizworld.xyz',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: localFixtures,
      use: { browserName: 'chromium' },
    },
    {
      name: 'local-fixtures',
      testMatch: localFixtures,
      use: { browserName: 'chromium', baseURL: localFixtureURL },
    },
  ],
});
