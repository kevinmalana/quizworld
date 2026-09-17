import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepository, STORAGE_KEY, MAX_STORAGE_BYTES } from './storage';
import { emptyState, startSession, answerCurrent } from './study/model';
import { pack } from './study/fixture';

test('a saved checkpoint reloads with the mistake and cannot double count an answer', async () => {
  const memory = new Map<string, string>();
  const store = { getItem: async (k: string) => memory.get(k) ?? null, setItem: async (k: string, v: string) => { memory.set(k, v); } };
  const repo = createRepository(store);
  const state = answerCurrent(startSession(emptyState(), pack, 'quickfire', 'attempt', 1), 'b', 2);
  await repo.save(state);
  assert.deepEqual(await createRepository(store).load(), state);
  memory.set(STORAGE_KEY, '{broken');
  await assert.rejects(repo.load(), /saved practice/i);
  assert.equal(memory.get(STORAGE_KEY), '{broken');
});

test('write failure never claims a successful save', async () => {
  const repo = createRepository({ getItem: async () => null, setItem: async () => { throw new Error('disk full'); } });
  await assert.rejects(repo.save(emptyState()), /disk full/);
  assert.deepEqual(await repo.load(), emptyState());
});

test('oversized valid state is refused on load and save without writing', async () => {
  let writes = 0;
  const largePack = { ...pack, questions: Array.from({ length: 100 }, (_, i) => ({ ...pack.questions[0], id: `q${i}`, text: 'x'.repeat(12000) })) };
  const state = startSession(emptyState(), largePack, 'quickfire', 'large', 1);
  const raw = JSON.stringify(state);
  assert.ok(raw.length * 2 > MAX_STORAGE_BYTES);
  const repo = createRepository({ getItem: async () => raw, setItem: async () => { writes++; } });
  await assert.rejects(repo.load(), /saved practice/i);
  await assert.rejects(repo.save(state), /storage limit/i);
  assert.equal(writes, 0);
});
