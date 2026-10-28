import assert from 'node:assert/strict';
import test from 'node:test';

// The HTTP path must have the same bounded, non-replayed uncertainty semantics
// as socket commands. These tests replace only fetch and the test clock.
test('HTTP commands time out without automatically replaying the mutation', async (t) => {
  process.env.NEXT_PUBLIC_GAME_ENGINE = 'phoenix';
  process.env.NEXT_PUBLIC_GAME_SERVICE_URL = 'https://fixture.invalid';
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const original = globalThis.fetch;
  let calls = 0;
  let signal: AbortSignal | undefined;
  globalThis.fetch = async (_url, init) => {
    calls += 1; signal = init?.signal as AbortSignal | undefined;
    return new Promise((_resolve,reject) => signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));
  };
  try {
    const { answerPhoenixSession } = await import('./game-engine/client');
    const pending = answerPhoenixSession('000000',{player_id:'local-player',player_token:'synthetic',answer_id:'a',response_time_ms:10});
    assert.ok(signal, 'HTTP mutation needs a deadline signal');
    const checked = assert.rejects(pending, (error: unknown) => {
      assert.equal((error as {reason?:string}).reason,'timeout');return true;
    });
    t.mock.timers.tick(20_000);
    await checked;
    assert.equal(calls,1,'uncertain commands must never be replayed');
  } finally { globalThis.fetch = original; }
});

test('completed HTTP requests clear their deadline rather than abort later',async(t)=>{
  process.env.NEXT_PUBLIC_GAME_ENGINE='phoenix';process.env.NEXT_PUBLIC_GAME_SERVICE_URL='https://fixture.invalid';
  t.mock.timers.enable({apis:['setTimeout']});const original=globalThis.fetch;let signal:AbortSignal|undefined;
  globalThis.fetch=async(_url,init)=>{signal=init?.signal as AbortSignal|undefined;return new Response(JSON.stringify({session:{status:'waiting'}}));};
  try {const {fetchPhoenixSession}=await import('./game-engine/client');await fetchPhoenixSession('000000');assert.ok(signal);t.mock.timers.tick(20_000);assert.equal(signal?.aborted,false);} finally {globalThis.fetch=original;}
});
import { readFileSync } from 'node:fs';

test('malformed command replies are uncertain rather than a success acknowledgment',async()=>{
  process.env.NEXT_PUBLIC_GAME_ENGINE='phoenix';process.env.NEXT_PUBLIC_GAME_SERVICE_URL='https://fixture.invalid';
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response('not-json',{status:200});
  try {const {startPhoenixSession}=await import('./game-engine/client');await assert.rejects(startPhoenixSession('000000','synthetic'),(error:unknown)=>{assert.equal((error as {reason?:string}).reason,'unavailable');return true;});}finally{globalThis.fetch=original;}
});

// A structural safety contract, alongside the actual route/browser fixtures:
// supported live routes must not retain a second database-owned game engine.
test('live game and join keep Phoenix as their only active data/command path', () => {
  for (const file of ['app/game/[pin]/page.tsx', 'app/join/page.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /@\/lib\/supabase\/client/, `${file} still imports the legacy data transport`);
    assert.doesNotMatch(source, /lookup_game_by_pin|join_game_session|submit_player_answer|finish_game_and_record_results|reveal_current_question|start_game_session|advance_game_session|postgres_changes/);
    assert.match(source, /legacySupabaseGameEngine/, 'preserve the existing unsupported-engine refusal instead of silently changing configuration behavior');
  }
});

test('HTTP game errors preserve server reasons independently of display copy', async () => {
  process.env.NEXT_PUBLIC_GAME_ENGINE = 'phoenix';
  process.env.NEXT_PUBLIC_GAME_SERVICE_URL = 'https://fixture.invalid';
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({error:'Localized room lookup failure',reason:'not_found'}), {status:404,headers:{'Content-Type':'application/json'}});
  try {
    const { fetchPhoenixSession } = await import('./game-engine/client');
    await assert.rejects(fetchPhoenixSession('000000'), (error: unknown) => {
      assert.equal((error as {reason?: string}).reason, 'not_found');
      assert.equal((error as Error).message, 'Localized room lookup failure');
      return true;
    });
  } finally { globalThis.fetch = original; }
});
