import { test, expect } from '@playwright/test';

test('mobile home keeps labelled PIN joining inline and preserves destination', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Game PIN or presentation code', exact: true });
  await expect(input).toBeVisible();
  const bounds = await input.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThan(700);
  await input.fill('12');
  await page.getByRole('button', { name: 'Enter Game', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Game PINs are 6 characters' })).toHaveText('Game PINs are 6 characters');
  await input.fill('ab12cd');
  await page.getByRole('button', { name: 'Enter Game', exact: true }).click();
  await expect(page).toHaveURL(/\/join\?pin=AB12CD$/);
});

test('narrow mobile home displays the entire entered PIN without input scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Game PIN or presentation code', exact: true });
  await input.fill('ABC123');
  expect(await input.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Enter Game', exact: true }).click();
  await expect(page).toHaveURL(/\/join\?pin=ABC123$/);
});

test('library search is labelled and can be cleared without losing sort controls', async ({ page }) => {
  await page.goto('/explore');
  const search = page.getByRole('searchbox', { name: 'Search public quizzes' });
  await expect(search).toBeVisible();
  await search.fill('qwuiregressionnomatch987654321');
  await expect(page.getByRole('heading', { name: 'No quizzes match your search' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('status').filter({ hasText: /^0 results$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear search', exact: true })).toBeVisible();
  const clear = page.getByRole('button', { name: 'Clear search', exact: true });
  await clear.focus();
  await page.keyboard.press('Enter');
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(page.getByRole('button', { name: /Most Played/ })).toHaveAttribute('aria-pressed', 'true');
});
