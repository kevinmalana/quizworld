import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, startSession, answerCurrent, advanceSession } from './model';
import type { Pack } from './types';

export const pack: Pack = { id: 'demo', revision: '1', title: 'Geography', category: 'Geography', source: 'bundled', sourceLabel: 'Repository sample', questions: [{ id: 'q1', text: 'Largest continent?', answers: [{ id: 'a', text: 'Asia', is_correct: true }, { id: 'b', text: 'Europe', is_correct: false }] }] };

test('a missed answer persists its checkpoint and enters the review queue once', () => {
  const state = startSession(emptyState(), pack, 'quickfire', 'attempt-1', 1000);
  const answered = answerCurrent(state, 'b', 2000);
  assert.equal(answered.active?.responses.length, 1);
  assert.equal(answered.active?.responses[0].correct, false);
  assert.equal(answered.reviews.length, 1);
  assert.equal(answered.reviews[0].dueAt, 2000);
  assert.deepEqual(answerCurrent(answered, 'a', 3000), answered);
  const finished = advanceSession(answered, 3000);
  assert.equal(finished.history[0].correct, 0);
  assert.equal(finished.history[0].total, 1);
  assert.equal(finished.active?.completedAt, 3000);
  assert.deepEqual(advanceSession(finished, 4000), finished);
  assert.equal('xp' in finished.history[0], false);
});
