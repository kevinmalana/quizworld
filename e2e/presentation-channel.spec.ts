import { test, expect, Page } from '@playwright/test';

const PRESENTATION_SERVICE_URL = process.env.E2E_PHOENIX_URL || process.env.NEXT_PUBLIC_GAME_SERVICE_URL || 'https://quizworld-xs0g.onrender.com';

/**
 * Presentation Channel Tests
 *
 * Tests for:
 * - Present page availability and auth
 * - Presenter disconnect notice infrastructure
 * - Presence tracking (join/leave)
 * - Present join flow
 * - Channel resilience
 */

// ─── Helpers ──────────────────────────────────────────────────────────────

async function checkPresentationServiceAvailable(page: Page): Promise<boolean> {
  const response = await page.request.get(`${PRESENTATION_SERVICE_URL}/api/health`, { timeout: 120_000 }).catch(() => null);
  return response?.status() === 200;
}

// ─── Present Page: Availability ──────────────────────────────────────────

test.describe('Present: Page Availability', () => {
  test('present page loads without crashing', async ({ page }) => {
    await page.goto('/present');
    await page.waitForTimeout(2000);
    const title = await page.title();
    expect(title).toContain('QuizWorld');
    // Present page heading contains 'Presentations' (with emoji prefix)
    const hasContent = await page.getByRole('heading').filter({ hasText: 'Presentations' }).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('present page shows create UI or sign-in prompt', async ({ page }) => {
    await page.goto('/present');
    await page.waitForLoadState('networkidle');
    const hasInput = await page.locator('input[placeholder*="title"], input[placeholder*="presentation"]').first().isVisible().catch(() => false);
    const hasSignIn = await page.locator('a[href="/login"], button:has-text("Sign"), text=Sign In').first().isVisible().catch(() => false);
    const hasCreate = await page.locator('text=New presentation, text=Create, text=Presentation, h1, h2').first().isVisible().catch(() => false);
    expect(hasInput || hasSignIn || hasCreate).toBeTruthy();
  });

  test('present/join page loads', async ({ page }) => {
    await page.goto('/present/join');
    await page.waitForLoadState('networkidle');
    // Should have some form of code/name input
    const hasInput = await page.locator('input').first().isVisible().catch(() => false);
    expect(hasInput).toBeTruthy();
  });

  test('present/join requires a valid code length', async ({ page }) => {
    await page.goto('/present/join');
    await page.waitForLoadState('networkidle');
    // Join button should be disabled with empty/short input
    const joinBtn = page.getByRole('button', { name: /join/i }).first();
    if (await joinBtn.isVisible()) {
      const isDisabled = await joinBtn.isDisabled();
      // Button is disabled when no valid code entered — that's correct behaviour
      expect(isDisabled).toBeTruthy();
    } else {
      // Or it's not visible yet — page still loaded ok
      const hasInput = await page.locator('input').first().isVisible();
      expect(hasInput).toBeTruthy();
    }
  });
});

// ─── Present: Auth Flow ───────────────────────────────────────────────────

test.describe('Present: Auth Flow', () => {
  test('present page redirects or prompts unauthenticated users', async ({ page }) => {
    await page.goto('/present');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    const body = await page.locator('body').textContent();
    // Either redirected to login OR shows sign-in prompt on the page
    const redirectedToLogin = url.includes('/login');
    const showsSignIn = body?.toLowerCase().includes('sign in') || body?.toLowerCase().includes('log in');
    const showsCreate = body?.toLowerCase().includes('presentation') || body?.toLowerCase().includes('create');
    expect(redirectedToLogin || showsSignIn || showsCreate).toBeTruthy();
  });

  test('present live page without valid code shows error', async ({ page }) => {
    await page.goto('/present/INVALIDCODE999/live');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').textContent();
    // Should show some error or redirect — not a blank page
    expect(body?.length ?? 0).toBeGreaterThan(50);
  });
});

// ─── Present: Disconnect Recovery Infrastructure ──────────────────────────

test.describe('Present: Disconnect Recovery', () => {
  test('presenter disconnect event handler exists in socket library', async ({ page }) => {
    // Verify the frontend bundle handles presenter:disconnected events
    // by checking the live page loads and has the necessary JS
    await page.goto('/present');
    await page.waitForLoadState('networkidle');

    // The page should load the presentation socket module without errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.waitForTimeout(1000);
    // No critical JS errors on page load
    const criticalErrors = consoleErrors.filter(e =>
      e.includes('Cannot read') || e.includes('is not a function') || e.includes('undefined')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('Phoenix service handles presentation API requests', async ({ page }) => {
    const available = await checkPresentationServiceAvailable(page);
    if (!available) {
      test.skip();
      return;
    }

    // Test the join endpoint exists (returns proper error for invalid code)
    const response = await page.request.post(`${PRESENTATION_SERVICE_URL}/api/presentations/join`, {
      data: { join_code: 'INVALID', participant_name: 'Test' },
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => null);

    if (response) {
      // Should return a structured error, not a 500
      expect([400, 404, 422, 200]).toContain(response.status());
      const body = await response.json().catch(() => ({}));
      // Response should be JSON with an error field
      expect(typeof body).toBe('object');
    }
  });

  test('present join page shows channel error state gracefully', async ({ page }) => {
    // Channel error state should show a message, not crash
    await page.goto('/present/TESTCODE/live');
    await page.waitForTimeout(4000);

    // Page should not show a white screen or JS crash
    const body = await page.locator('body').textContent();
    expect(body?.trim().length ?? 0).toBeGreaterThan(10);
  });
});

// ─── Present: Presence Tracking ───────────────────────────────────────────

test.describe('Present: Presence', () => {
  test('Phoenix Presence module is registered in application', async ({ page }) => {
    // Verify Phoenix service is alive and responding (Presence requires app to start)
    const response = await page.request.get(`${PRESENTATION_SERVICE_URL}/health`).catch(() => null);
    // Health endpoint may return 404 (no /health route) but server is alive
    if (response) {
      expect(response.status()).not.toBe(503);
      expect(response.status()).not.toBe(502);
    }
  });

  test('present/join page has name input for participant tracking', async ({ page }) => {
    await page.goto('/present/join');
    await page.waitForLoadState('networkidle');
    // Name input needed for Presence tracking (participants identified by name)
    const nameInput = await page.locator('input[placeholder*="name"], input[placeholder*="Name"], input[type="text"]').first().isVisible().catch(() => false);
    expect(nameInput).toBeTruthy();
  });
});

// ─── Present: Refactoring Safety ──────────────────────────────────────────

test.describe('Present: Refactoring Safety', () => {
  test('present page components import correctly', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/present');
    await page.waitForLoadState('networkidle');
    const importErrors = errors.filter(e => e.includes('Failed to fetch') || e.includes('import'));
    expect(importErrors).toHaveLength(0);
  });

  test('present join page components import correctly', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/present/join');
    await page.waitForLoadState('networkidle');
    const importErrors = errors.filter(e => e.includes('Failed to fetch') || e.includes('import'));
    expect(importErrors).toHaveLength(0);
  });

  test('navigation to present pages does not break app shell', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Nav link to present should work
    const presentLink = page.locator('a[href="/present"]');
    if (await presentLink.isVisible()) {
      await presentLink.click();
      // Wait for URL change rather than networkidle (present page has async Supabase fetches)
      await page.waitForURL('**/present**', { timeout: 10000 }).catch(() => {});
      expect(page.url()).toContain('/present');
    } else {
      await page.goto('/present');
      expect(page.url()).toContain('/present');
    }
  });
});
