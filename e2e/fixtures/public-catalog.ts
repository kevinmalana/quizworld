import { expect, type Page } from '@playwright/test';

// Synthetic public metadata only. This exercises the real Explore client/card,
// not the live catalog, SSR catalog availability, authentication, or game APIs.
const quiz = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'local-ux-fixture',
  title: 'Local UX fixture quiz',
  description: 'Deterministic public catalog metadata for local UI assertions.',
  category: 'General Knowledge',
  creator_id: null,
  is_public: true,
  archived_at: null,
  plays: 12,
  question_count: 5,
  created_at: '2026-01-01T00:00:00.000Z',
  color: '#7c3aed',
  emoji: '🧪',
};

export async function installPublicCatalogFixture(page: Page, baseURL: string) {
  const local = new URL(baseURL);
  expect(local.protocol).toBe('http:');
  expect(local.hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  await page.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === local.origin) return route.continue();
    // Serve only public, non-archived catalog reads at the explicit dummy
    // origin. Block every other external request, including real credentials'
    // destinations in an accidentally reused developer build.
    if (url.origin === 'https://quizworld-local-fixture.invalid'
        && url.pathname === '/rest/v1/quizzes'
        && ['GET', 'HEAD'].includes(request.method())
        && url.searchParams.get('is_public') === 'eq.true'
        && url.searchParams.get('archived_at') === 'is.null') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': '0-0/1' },
        body: request.method() === 'HEAD' ? '' : JSON.stringify([quiz]),
      });
    }
    return route.abort();
  });
}
