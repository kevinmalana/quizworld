// Local regression for the mobile catalog budget: the first real library
// card must appear before 700px at 390px width. This exists because the
// play-counter provenance disclosure added by the PR #35 refactor pushed the
// first card to 714px, which failed only in the production E2E job.
import { test, expect } from '@playwright/test';
import { installPublicCatalogFixture } from './fixtures/public-catalog';

test.beforeEach(async ({ page, baseURL }) => {
  expect(new URL(baseURL!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  await installPublicCatalogFixture(page, baseURL!);
});

test('mobile library reaches real content before 700px with the counter disclosure', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/explore', { waitUntil: 'networkidle' });
  const card = page.locator('.explore-quiz-card').first();
  await expect(card).toBeVisible();
  expect((await card.boundingBox())!.y).toBeLessThan(700);
  // The disclosure stays, and it stays honest about what the counter means.
  const note = page.locator('.explore-counter-note');
  await expect(note).toBeVisible();
  await expect(note).toContainText('not verified completions');
});
