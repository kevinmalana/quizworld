import { test, expect } from '@playwright/test';

const google = /https:\/\/(?:[^/]+\.)?(?:google-analytics\.com|googletagmanager\.com|doubleclick\.net)\//;

test('analytics consent is explicit, revocable, sanitized and route-scoped', async ({ page, baseURL }) => {
  expect(new URL(baseURL!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  const requests: string[] = [];
  await page.route(google, async route => {
    requests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });
  await page.goto('/?email=child@example.com&utm_source=PRIVATE#SECRET');
  await expect(page.getByRole('button', { name: 'Reject analytics', exact: true })).toBeVisible();
  expect(requests).toEqual([]);
  await page.getByRole('button', { name: 'Reject analytics', exact: true }).click();
  await page.reload();
  expect(requests).toEqual([]);
  await page.getByRole('button', { name: 'Analytics preferences', exact: true }).click();
  await page.getByRole('button', { name: "I'm 18 or older — allow analytics", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  const frame = page.frame({ url: /analytics-frame\.html/ })!;
  const commands = await frame.evaluate(() => Array.from((window as unknown as { dataLayer: IArguments[] }).dataLayer, c => Array.from(c)));
  expect(JSON.stringify(commands)).not.toMatch(/child@|PRIVATE|SECRET|email|utm_source/);
  expect(commands.filter(c => c[0] === 'event' && c[1] === 'page_view')).toHaveLength(1);
  expect(commands.find(c => c[0] === 'config')?.[1]).toBe('G-1YJEL65QPS');
  // Native history updates exercise Next's usePathname SPA boundary without
  // waiting for unrelated catalog/API fixtures.
  await page.evaluate(() => history.pushState({}, '', '/kahoot-alternative?email=child@example.com#PRIVATE'));
  await expect.poll(() => requests.length).toBe(2);
  await page.evaluate(() => history.pushState({}, '', '/kahoot-alternative?email=other@example.com#SECRET'));
  await expect(page.locator('iframe[title="Optional analytics"]')).toHaveCount(1);
  expect(requests).toHaveLength(2);
  await page.evaluate(() => history.pushState({}, '', '/game/PRIVATE?answer=SECRET'));
  await expect(page.locator('iframe[title="Optional analytics"]')).toHaveCount(0);
  expect(requests).toHaveLength(2);
  await page.evaluate(() => history.pushState({}, '', '/'));
  await expect.poll(() => requests.length).toBe(3);
  await page.evaluate(() => { document.cookie = 'qwga_ga=test; path=/'; document.cookie = 'qwga_ga_1YJEL65QPS=test; path=/'; document.cookie = 'essential=test; path=/'; });
  await page.getByRole('button', { name: 'Analytics preferences', exact: true }).click();
  await page.getByRole('button', { name: 'Reject analytics', exact: true }).click();
  await expect(page.locator('iframe[title="Optional analytics"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.cookie)).not.toContain('qwga_');
  expect(await page.evaluate(() => document.cookie)).toContain('essential=test');
  await page.reload();
  expect(requests).toHaveLength(3);
});

test('stored grant never loads analytics on private routes and unknown old consent is not opt-in', async ({ page, baseURL }) => {
  expect(new URL(baseURL!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  const requests: string[] = [];
  await page.route(google, async route => { requests.push(route.request().url()); await route.abort(); });
  await page.addInitScript(() => { localStorage.setItem('qw_cookie_consent', '1'); });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Reject analytics', exact: true })).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.evaluate(() => localStorage.setItem('qw_analytics_consent_v1', 'adult-granted'));
  for (const route of ['/join?pin=SECRET', '/login?email=child@example.com', '/privacy', '/study']) {
    await page.goto(route);
    await expect(page.getByRole('button', { name: 'Analytics preferences', exact: true })).toBeVisible();
    await expect(page.locator('iframe[title="Optional analytics"]')).toHaveCount(0);
  }
  expect(requests).toHaveLength(0);
});
