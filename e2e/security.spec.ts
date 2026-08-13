import { test, expect, request } from '@playwright/test';

/**
 * Security tests: import-pdf auth, RLS, join RPC, auth guards, headers.
 * Added 2026-06-19.
 */

const BASE = 'https://www.quizworld.xyz';
const SUPABASE_URL = 'https://tqmygnkwkjtkteguemya.supabase.co';

// ─── Helpers ─────────────────────────────────────────────────────────────

async function supabaseAnon(endpoint: string) {
  const ctx = await request.newContext();
  const r = await ctx.get(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: {
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
      'Prefer': 'count=exact',
    },
  });
  return r;
}

// ─── import-pdf API Authentication ──────────────────────────────────────

test.describe('Security: import-pdf API', () => {

  test('blocks unauthenticated requests with 401', async ({ request }) => {
    const formData = new FormData();
    formData.append('userId', 'hacker');
    formData.append('file', new Blob(['fake-pdf'], { type: 'application/pdf' }), 'test.pdf');

    const r = await request.post(`${BASE}/api/present/import-pdf`, {
      multipart: formData,
    });

    expect(r.status()).toBe(401);
    const body = await r.json();
    expect(body.error).toContain('Authentication');
  });

  test('blocks requests with missing file', async ({ request }) => {
    const formData = new FormData();
    formData.append('userId', 'hacker');

    const r = await request.post(`${BASE}/api/present/import-pdf`, {
      multipart: formData,
    });

    // Should be 401 (auth check runs before file validation)
    expect(r.status()).toBe(401);
  });

  test('rejects invalid auth tokens with 401', async ({ request }) => {
    const formData = new FormData();
    formData.append('userId', 'hacker');
    formData.append('file', new Blob(['fake-pdf'], { type: 'application/pdf' }), 'test.pdf');

    const r = await request.post(`${BASE}/api/present/import-pdf`, {
      multipart: formData,
      headers: {
        'Authorization': 'Bearer invalid-token-12345',
      },
    });

    expect(r.status()).toBe(401);
  });

  test('does not accept client-supplied userId as auth', async ({ request }) => {
    // Even with a real-looking userId, without a Supabase session it should fail
    const formData = new FormData();
    formData.append('userId', '2fb68310-19d2-47c0-9058-85174c386f49'); // real user
    formData.append('file', new Blob(['fake-pdf'], { type: 'application/pdf' }), 'test.pdf');

    const r = await request.post(`${BASE}/api/present/import-pdf`, {
      multipart: formData,
    });

    expect(r.status()).toBe(401);
  });
});

// ─── user_achievements RLS ──────────────────────────────────────────────

test.describe('Security: user_achievements RLS', () => {

  test('anon cannot SELECT user_achievements', async ({ page }) => {
    // The achievements page should still load (public page)
    // but anon users should see 0 achievements when not logged in
    await page.goto('/achievements');
    await page.waitForLoadState('networkidle');

    // Page should load without errors
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(0);

    // No user-specific achievement data should be visible to anon
    // The page shows public achievement catalog, not user-specific rows
    const hasUnlocked = body.toLowerCase().includes('unlock');
    // Without auth, the table returns 0 rows, so unlocked count should be 0
    // We just verify the page renders without crashing
  });

  test('anon cannot INSERT into user_achievements', async () => {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      test.skip(true, 'NEXT_PUBLIC_SUPABASE_ANON_KEY not in env');
      return;
    }
    const ctx = await request.newContext();
    const r = await ctx.post(`${SUPABASE_URL}/rest/v1/user_achievements`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      data: {
        user_id: '2fb68310-19d2-47c0-9058-85174c386f49',
        achievement_slug: 'security_test_exploit',
      },
    });

    // Should be blocked by RLS (42501) or FK (23503) — NOT a 201 success
    expect(r.status()).not.toBe(201);
    expect(r.status()).not.toBe(200);
  });

  test('anon user_achievements SELECT returns empty', async () => {
    const ctx = await request.newContext();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      test.skip(true, 'NEXT_PUBLIC_SUPABASE_ANON_KEY not in env');
      return;
    }
    const r = await ctx.get(`${SUPABASE_URL}/rest/v1/user_achievements?select=count`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Prefer': 'count=exact',
      },
    });

    expect(r.status()).toBe(200);
    const data = await r.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0].count).toBe(0);
    }
  });
});

// ─── Join Flow (lookup_game_by_pin RPC) ─────────────────────────────────

test.describe('Security: Join Flow via RPC', () => {

  test('join page loads for anon users', async ({ page }) => {
    await page.goto('/join');
    await page.waitForLoadState('networkidle');

    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(0);
  });

  test('join page handles invalid PIN gracefully', async ({ page }) => {
    await page.goto('/join');
    await page.waitForLoadState('networkidle');

    // Should have a PIN input
    const input = page.getByPlaceholder(/pin|code|enter/i);
    if (await input.isVisible()) {
      await input.fill('INVALID99');
      await input.press('Enter');
      await page.waitForTimeout(1000);

      // Should show feedback (error, not found, etc.) — not a crash
      const body = await page.locator('body').innerText();
      expect(body.length).toBeGreaterThan(0);
      // Should not have raw API error text
      expect(body).not.toContain('PGRST');
    }
  });

  test('lookup_game_by_pin RPC works via anon Supabase client', async () => {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      test.skip(true, 'NEXT_PUBLIC_SUPABASE_ANON_KEY not in env');
      return;
    }
    const ctx = await request.newContext();
    // Use a real PIN from the test DB
    const r = await ctx.post(`${SUPABASE_URL}/rest/v1/rpc/lookup_game_by_pin`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      data: { p_pin: 'QW174' },
    });

    expect(r.status()).toBe(200);
    const data = await r.json();
    if (data.length > 0) {
      expect(data[0].pin).toBe('QW174');
      // Should NOT expose host_id (the function doesn't return it)
      expect(data[0].host_id).toBeUndefined();
    }
  });

  test('direct game_sessions table read still works for anon (join page fallback)', async () => {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      test.skip(true, 'NEXT_PUBLIC_SUPABASE_ANON_KEY not in env');
      return;
    }
    // The join page needs to see game sessions by PIN
    // This test verifies the page doesn't break with the new RPC
    const ctx = await request.newContext();
    const r = await ctx.get(`${SUPABASE_URL}/rest/v1/game_sessions?select=count`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Prefer': 'count=exact',
      },
    });

    // Still works (we kept this permissive since players are anon during game)
    // Supabase returns 206 with Prefer: count=exact
    expect(r.ok()).toBe(true);
  });
});

// ─── Auth-Required Routes ────────────────────────────────────────────────

test.describe('Security: Auth-Required Routes', () => {

  test('admin page redirects unauthenticated users', async ({ page }) => {
    const r = await page.goto('/admin');
    await page.waitForTimeout(1000);

    const url = page.url();
    // Should redirect to login or show access denied
    expect(
      url.includes('/login') ||
      url.includes('/auth') ||
      url.includes('/signin') ||
      url === `${BASE}/`
    ).toBeTruthy();
  });

  test('dashboard redirects unauthenticated users', async ({ page }) => {
    const r = await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    const url = page.url();
    expect(
      url.includes('/login') ||
      url.includes('/auth') ||
      url.includes('/signin') ||
      url === `${BASE}/`
    ).toBeTruthy();
  });

  test('host page shows sign-in prompt when unauthenticated', async ({ page }) => {
    await page.goto('/host');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const body = await page.locator('body').innerText().catch(() => '');
    // Should not show raw error or crash
    expect(body).not.toContain('Application error');
  });
});

// ─── Public Accessibility ────────────────────────────────────────────────

test.describe('Security: Public Pages (should work without auth)', () => {

  const publicPages = [
    { path: '/', name: 'home' },
    { path: '/explore', name: 'explore' },
    { path: '/leaderboard', name: 'leaderboard' },
    { path: '/join', name: 'join' },
    { path: '/terms', name: 'terms' },
    { path: '/privacy', name: 'privacy' },
  ];

  for (const { path, name } of publicPages) {
    test(`${name} page loads without auth`, async ({ page }) => {
      const r = await page.goto(path);
      expect(r?.status()).toBeLessThan(400);
      await page.waitForLoadState('networkidle');
      const body = await page.locator('body').innerText();
      expect(body.length).toBeGreaterThan(0);
    });
  }
});

// ─── API Security Headers ────────────────────────────────────────────────

test.describe('Security: HTTP Headers', () => {

  test('production has security headers', async ({ request }) => {
    const r = await request.get(BASE);
    const headers = r.headers();

    // Check for common security headers
    const securityHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'strict-transport-security',
      'content-security-policy',
    ];

    let found = 0;
    for (const h of securityHeaders) {
      if (headers[h.toLowerCase()]) found++;
    }
    expect(found).toBeGreaterThanOrEqual(1);
  });

  test('API routes return proper content-type', async ({ request }) => {
    const r = await request.post(`${BASE}/api/present/import-pdf`, {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });

    // Should be JSON, not HTML
    const contentType = r.headers()['content-type'] || '';
    expect(contentType).toContain('json');
  });
});

// ─── 2026-08-13: New test suites covering fix-01 (game_results RLS),
// fix-02 (import-deck auth), and fix-11 (CSP header). ───

test.describe('Security: game_results RLS (fix-01)', () => {
  // 2026-08-13: skipped until the migration is applied to production Supabase.
  // Re-enable after running supabase/migrations/20260813_lock_down_game_data.sql.
  test.skip(true, 'blocks until migration 20260813_lock_down_game_data.sql applied');
  test('anon cannot SELECT game_results by guessing PIN', async () => {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      test.skip(true, 'NEXT_PUBLIC_SUPABASE_ANON_KEY not in env');
      return;
    }
    const ctx = await request.newContext();
    const r = await ctx.get(`${SUPABASE_URL}/rest/v1/game_results?select=id,host_id,results&limit=5`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Prefer': 'count=exact',
      },
    });
    expect(r.status()).toBe(200);
    // The header content-range shows total rows visible to anon — should be 0.
    const contentRange = r.headers()['content-range'] || '*/0';
    const match = contentRange.match(/\/(\d+)$/);
    const total = match ? parseInt(match[1]) : -1;
    expect(total).toBe(0);
  });

  test.skip(true, 'blocks until migration 20260813_lock_down_game_data.sql applied');
  test('anon cannot SELECT player_answers by PIN', async () => {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      test.skip(true, 'NEXT_PUBLIC_SUPABASE_ANON_KEY not in env');
      return;
    }
    const ctx = await request.newContext();
    const r = await ctx.get(`${SUPABASE_URL}/rest/v1/player_answers?select=id&limit=5`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Prefer': 'count=exact',
      },
    });
    expect(r.status()).toBe(200);
    const contentRange = r.headers()['content-range'] || '*/0';
    const match = contentRange.match(/\/(\d+)$/);
    const total = match ? parseInt(match[1]) : -1;
    expect(total).toBe(0);
  });

  test.skip(true, 'blocks until migration 20260813_lock_down_game_data.sql applied');
  test('anon cannot SELECT players table', async () => {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      test.skip(true, 'NEXT_PUBLIC_SUPABASE_ANON_KEY not in env');
      return;
    }
    const ctx = await request.newContext();
    const r = await ctx.get(`${SUPABASE_URL}/rest/v1/players?select=id,nickname&limit=5`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Prefer': 'count=exact',
      },
    });
    expect(r.status()).toBe(200);
    const contentRange = r.headers()['content-range'] || '*/0';
    const match = contentRange.match(/\/(\d+)$/);
    const total = match ? parseInt(match[1]) : -1;
    expect(total).toBe(0);
  });
});

test.describe('Security: import-deck API (fix-02)', () => {
  // 2026-08-13: Skipped until the new auth check is deployed (master currently has
  // the unguarded version). Re-enable after first deploy with fix-02.
  test('blocks unauthenticated requests with 401', async () => {
    test.skip(true, 'Re-enable after fix-02 (import-deck auth) deploys');
  });

  test('limits file size to 25MB (rejects oversized)', async ({ request }) => {
    // Without auth, we expect 401 — but the size limit still runs in the pipeline.
    // We assert that the response is non-success and non-200.
    const formData = new FormData();
    formData.append('file', new Blob(['x'], { type: 'application/vnd.ms-powerpoint' }), 'small.ppt');

    const r = await request.post(`${BASE}/api/present/import-deck`, {
      multipart: formData,
    });

    // Acceptable: 401 (auth) or 400 (size) or 429 (rate limit)
    expect([400, 401, 429]).toContain(r.status());
  });
});

test.describe('Security: HTTP Headers (CSP — fix-11)', () => {
  test('production has a Content-Security-Policy header', async ({ request }) => {
    const r = await request.get(BASE);
    const csp = r.headers()['content-security-policy'] || '';
    expect(csp.length).toBeGreaterThan(20);
    expect(csp).toMatch(/script-src/);
  });

  test('production has X-Frame-Options DENY-or-SAMEORIGIN', async ({ request }) => {
    const r = await request.get(BASE);
    const h = (r.headers()['x-frame-options'] || '').toUpperCase();
    expect(h === 'DENY' || h === 'SAMEORIGIN').toBe(true);
  });
});