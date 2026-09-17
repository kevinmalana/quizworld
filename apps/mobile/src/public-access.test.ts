import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pack } from './study/fixture';

test('saved public access fails closed for revoked, private, archived and offline responses', async () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://quizworld-mobile-fixture.invalid';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_local_fixture_not_a_real_key';
  const { checkPublicAccess } = await import('./public-access');
  const original = globalThis.fetch;
  const publicPack = { ...pack, source: 'public' as const };
  let calls = 0;
  let response: unknown = [{ id: pack.id, is_public: true, archived_at: null }];
  globalThis.fetch = async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.searchParams.get('is_public'), 'eq.true');
    assert.equal(url.searchParams.get('archived_at'), 'is.null');
    assert.equal(init?.method, 'GET');
    assert.equal(init?.credentials, 'omit');
    assert.equal(new Headers(init?.headers).has('authorization'), false);
    return new Response(JSON.stringify(response));
  };
  try {
    await checkPublicAccess(pack);
    assert.equal(calls, 0);
    await checkPublicAccess(publicPack);
    for (response of [[], null, [{ id: pack.id, is_public: false, archived_at: null }], [{ id: pack.id, is_public: true, archived_at: '2026-01-01' }], [{ id: 'other', is_public: true, archived_at: null }]]) {
      await assert.rejects(checkPublicAccess(publicPack));
    }
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    await assert.rejects(checkPublicAccess(publicPack), /connect/i);
    await checkPublicAccess(pack);
  } finally { globalThis.fetch = original; }
});
