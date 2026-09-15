import { defineConfig } from '@playwright/test';
import config, { localFixtureURL } from './playwright.config';

// npm run check builds first. Playwright owns startup/readiness/cleanup of
// this loopback-only production build; the public project never starts it.
const url = new URL(localFixtureURL);
export default defineConfig({
  ...config,
  projects: config.projects!.filter(project => project.name === 'local-fixtures'),
  webServer: {
    command: `npm run start -- --hostname ${url.hostname} --port ${url.port || '80'}`,
    url: `${localFixtureURL.replace(/\/$/, '')}/join`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // Match CI build-time values; never inherit a developer's live project.
    // The invalid origin makes SSR fail closed into the client catalog fixture.
    env: {
      NEXT_PUBLIC_GAME_SERVICE_URL: 'https://quizworld-ux-test.invalid',
      NEXT_PUBLIC_SUPABASE_URL: 'https://quizworld-local-fixture.invalid',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_local_fixture_not_a_real_key',
    },
  },
});
