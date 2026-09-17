import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pack } from './study/fixture';
import { parsePublicPack } from './catalog';

const row = { id: '15381af4-f5fd-41ed-beb9-0b6e4a57622d', title: 'Fixture', category: 'Test', is_public: true, archived_at: null, questions: [{ id: 'q1', text: 'Question?', question_type: 'multiple_choice', order_index: 0, answers: [{ id: 'a', text: 'Yes', is_correct: true }, { id: 'b', text: 'No', is_correct: false }] }] };

test('public access checks revision and fails closed for revoked/private/archived/offline', async () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://quizworld-mobile-fixture.invalid';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_local_fixture_not_a_real_key';
  const { checkPublicAccess } = await import('./public-access');
  const original = globalThis.fetch;
  const publicPack = parsePublicPack(row);
  let calls = 0;
  let response: unknown = [row];
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
    await assert.rejects(checkPublicAccess({ ...publicPack, revision: 'older' }), /has changed/);
    for (response of [[], null, [{ ...row, is_public: false }], [{ ...row, archived_at: '2026-01-01' }], [{ ...row, id: 'other' }]]) {
      await assert.rejects(checkPublicAccess(publicPack));
    }
    response = [{ ...row, questions: [{ ...row.questions[0], text: 'Edited wording' }] }];
    await assert.rejects(checkPublicAccess(publicPack), /has changed/);
    response = [{ ...row, questions: [{ ...row.questions[0], video_url: 'https://example.invalid/video' }] }];
    await assert.rejects(checkPublicAccess(publicPack), /not available/);
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    await assert.rejects(checkPublicAccess(publicPack), /connect/i);
    await checkPublicAccess(pack);
  } finally { globalThis.fetch = original; }
});
