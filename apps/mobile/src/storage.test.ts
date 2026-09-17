import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepository, STORAGE_KEY } from './storage';
import { emptyState, startSession, answerCurrent } from './study/model';
import { pack } from './study/model.test';

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

test('write failure never claims a successful save and oversized state is refused', async () => {
  const repo = createRepository({ getItem: async () => null, setItem: async () => { throw new Error('disk full'); } });
  await assert.rejects(repo.save(emptyState()), /disk full/);
  assert.deepEqual(await repo.load(), emptyState());
});
