import { test, expect } from '@playwright/test';

// Only run on a local candidate. No live games or production mutations.
test.beforeEach(async ({ page, baseURL }) => {
  expect(new URL(baseURL!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  await page.route('**/api/sessions**', route => route.abort());
});

test('quiz cards prioritize hosting and preview while retaining solo, study and share', async ({ page }) => {
  await page.goto('/explore', { waitUntil: 'networkidle' });
  const card = page.locator('.explore-quiz-card').first();
  await expect(card).toBeVisible();
  const hostHref = await card.getByRole('link', { name: 'Host', exact: true }).getAttribute('href');
  const detailHref = await card.getByRole('link', { name: 'View details →', exact: true }).getAttribute('href');
  await expect(card.getByRole('link', { name: /Play solo/ })).not.toBeVisible();
  const options = card.getByText('More options', { exact: true });
  await options.focus();
  await page.keyboard.press('Enter');
  await expect(card.getByRole('link', { name: 'Play solo', exact: true })).toHaveAttribute('href', hostHref!.replace('/host?quiz=', '/solo/'));
  await expect(card.getByRole('link', { name: 'Study', exact: true })).toHaveAttribute('href', detailHref!.replace('/quiz/', '/study/'));
  await expect(card.getByRole('button', { name: 'Share', exact: true })).toBeVisible();
  const actionGap = await options.evaluate(summary => {
    const action = summary.parentElement!.querySelector('a')!;
    return action.getBoundingClientRect().top - summary.getBoundingClientRect().bottom;
  });
  expect(actionGap).toBeGreaterThanOrEqual(8);
  await page.keyboard.press('Tab');
  await expect(card.getByRole('link', { name: 'Play solo', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(options).toBeFocused();
  await options.press('Enter');
  await expect(card.getByRole('link', { name: 'Play solo', exact: true })).not.toBeVisible();
  await expect(options).toBeFocused();
});

test('PIN lookup distinguishes unavailable service from missing rooms without clearing the PIN', async ({ page }) => {
  await page.goto('/join');
  await expect(page.getByText('No account needed', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Join a presentation', exact: true })).toHaveAttribute('href', '/present/join');
  const inputs = page.locator('input[aria-label^="PIN character"]');
  for (const [index, character] of [...'ABC123'].entries()) await inputs.nth(index).fill(character);
  await page.getByRole('button', { name: 'Enter Game', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Could not reach the game service');
  await expect(inputs.nth(0)).toHaveValue('A');
  await expect(inputs.nth(5)).toHaveValue('3');
  await expect(inputs.first()).toHaveAttribute('aria-invalid', 'false');
  await page.route('**/api/sessions/ABC123', route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Session not found' }) }));
  await page.getByRole('button', { name: 'Enter Game', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Check the PIN with your host');
  await expect(inputs.first()).toHaveAttribute('aria-invalid', 'true');
  await expect(inputs.nth(5)).toHaveValue('3');
});

test('hosting is discoverable in desktop navigation and early in the mobile menu', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Host', exact: true })).toHaveAttribute('href', '/host');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Navigation' });
  const host = dialog.getByRole('link', { name: 'Host a game', exact: true });
  await expect(host).toBeVisible();
  expect((await host.boundingBox())!.y).toBeLessThan(360);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeFocused();
});

test('host entry explains setup and keeps the chosen quiz through sign-in', async ({ page }) => {
  const quiz = '5ccd1d1d-6b6e-41bf-8601-3a4b31622034';
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`/host?quiz=${quiz}`);
  await expect(page.getByRole('button', { name: 'Sign In to Host', exact: true })).toBeVisible();
  expect((await page.getByRole('button', { name: 'Sign In to Host', exact: true }).boundingBox())!.y).toBeLessThan(600);
  await expect(page.getByText('Your quiz choice will follow you after sign-in.', { exact: true })).toBeVisible();
  await expect(page.getByText('Opening a lobby does not start the game.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign In to Host', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === '/login' && url.searchParams.get('next') === `/host?quiz=${quiz}`);
  expect(await page.evaluate(() => sessionStorage.getItem('qw_post_login_redirect'))).toBe(`/host?quiz=${quiz}`);
});
