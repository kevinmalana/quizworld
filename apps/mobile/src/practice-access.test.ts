import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPracticeAccess, clearDownloadedPractice } from './practice-access';
import { CatalogConnectionError } from './catalog';
import { emptyState, startSession, answerCurrent, advanceSession } from './study/model';
import { pack } from './study/fixture';

const publicPack = { ...pack, source: 'public' as const };
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };

test('public checks show pending then current; bundled does not request network', async () => {
  let calls = 0;
  const gate = createPracticeAccess(async () => { calls++; });
  assert.equal(await gate.check(pack), true);
  assert.equal(gate.getSnapshot().phase, 'bundled');
  assert.equal(calls, 0);
  const pending = gate.check(publicPack);
  assert.equal(gate.getSnapshot().phase, 'pending');
  assert.equal(await pending, true);
  assert.equal(gate.getSnapshot().phase, 'current');
  assert.equal(calls, 1);
});

test('offline and server errors fail closed without leaking transport errors', async () => {
  for (const [error, phase] of [[new CatalogConnectionError(), 'offline'], [new Error('secret-bearing backend error'), 'error']] as const) {
    const gate = createPracticeAccess(async () => { throw error; });
    assert.equal(await gate.check(publicPack), false);
    assert.equal(gate.getSnapshot().phase, phase);
    assert.doesNotMatch(JSON.stringify(gate.getSnapshot()), /secret-bearing/);
  }
});

test('logout/account disposal during a pending check never publishes or writes', async () => {
  const pending = deferred(); let saved = 0;
  const gate = createPracticeAccess(() => pending.promise);
  const action = gate.run(publicPack, async () => { saved++; });
  gate.dispose(); pending.resolve();
  assert.equal(await action, false);
  assert.equal(saved, 0);
  assert.equal(await gate.run(publicPack, async () => { saved++; }), false);
});

test('background invalidates pending success and foreground must check again', async () => {
  const pending = deferred(); let calls = 0; let saved = 0;
  const gate = createPracticeAccess(async () => { if (++calls === 1) await pending.promise; });
  const action = gate.run(publicPack, async () => { saved++; });
  gate.suspend(); pending.resolve();
  assert.equal(await action, false);
  assert.equal(saved, 0);
  assert.equal(gate.getSnapshot().phase, 'pending');
  assert.equal(await gate.check(publicPack), true);
  assert.equal(calls, 2);
});

test('concurrent duplicate actions are refused; retry after failure is allowed', async () => {
  const pending = deferred(); let saved = 0;
  const gate = createPracticeAccess(() => pending.promise);
  const first = gate.run(publicPack, async () => { saved++; });
  assert.equal(await gate.run(publicPack, async () => { saved++; }), false);
  pending.resolve(); assert.equal(await first, true); assert.equal(saved, 1);
  const retry = createPracticeAccess(async () => { if (saved++ === 1) throw new CatalogConnectionError(); });
  assert.equal(await retry.run(publicPack, async () => {}), false);
  assert.equal(await retry.run(publicPack, async () => {}), true);
});

test('late older revision check cannot override the newer result', async () => {
  const pending = deferred(); let calls = 0;
  const gate = createPracticeAccess(async () => { if (++calls === 1) await pending.promise; else throw new Error('revision changed'); });
  const old = gate.check(publicPack);
  assert.equal(await gate.check({ ...publicPack, revision: 'new' }), false);
  pending.resolve(); assert.equal(await old, false);
  assert.equal(gate.getSnapshot().phase, 'error');
});

test('clear downloads removes public checkpoint/review and legacy history titles, preserving bundled work', () => {
  const missed = answerCurrent(startSession(emptyState(), publicPack, 'quickfire', 'public', 1), 'b', 2);
  const finished = advanceSession(missed, 3);
  const clean = clearDownloadedPractice(finished);
  assert.deepEqual(clean, emptyState());
  const bundled = answerCurrent(startSession(finished, pack, 'quickfire', 'bundled', 4), 'b', 5);
  const cleaned = clearDownloadedPractice(bundled);
  assert.equal(cleaned.active?.id, 'bundled');
  assert.equal(cleaned.reviews.length, 1);
  assert.equal(cleaned.reviews[0].source, 'bundled');
  assert.equal(cleaned.history.length, 0);
  assert.deepEqual(clearDownloadedPractice(cleaned), cleaned);
});
