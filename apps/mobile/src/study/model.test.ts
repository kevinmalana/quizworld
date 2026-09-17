import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, startSession, answerCurrent, advanceSession } from './model';
import { pack } from './fixture';

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

test('retry schedule keeps revision provenance and history without mastery claims', () => {
  let state = advanceSession(answerCurrent(startSession(emptyState(), pack, 'quickfire', 'first', 1), 'b', 2), 3);
  for (const [index, days] of [1, 3, 7, 7].entries()) {
    const now = 100 + index;
    state = advanceSession(answerCurrent(startSession(state, pack, 'review', `retry-${index}`, now), 'a', now), now);
    assert.equal(state.reviews[0].dueAt, now + days * 86400000);
    assert.equal(state.reviews[0].successes, index + 1);
  }
  state = advanceSession(answerCurrent(startSession(state, { ...pack, revision: '2' }, 'quickfire', 'revised', 200), 'b', 201), 202);
  assert.equal(state.reviews.length, 2);
  assert.deepEqual(state.reviews.map(r => r.revision), ['1', '2']);
  assert.equal(state.history.find(h => h.id === 'first')?.correct, 0);
  state = answerCurrent(startSession(state, pack, 'review', 'miss-again', 300), 'b', 301);
  assert.equal(state.reviews.find(r => r.revision === '1')?.successes, 0);
  assert.equal(state.reviews.find(r => r.revision === '1')?.dueAt, 301);
});
