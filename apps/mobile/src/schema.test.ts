import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepository } from './storage';
import { emptyState, startSession, answerCurrent } from './study/model';
import { pack } from './study/fixture';

test('corrupt checked-answer identity or score is rejected without overwriting storage', async () => {
  const valid = answerCurrent(startSession(emptyState(), pack, 'quickfire', 'attempt', 1), 'b', 2);
  for (const response of [
    { questionId: 'q1', answerId: 'missing', correct: false },
    { questionId: 'q1', answerId: null, correct: true },
    { questionId: 'q1', answerId: 'b', correct: true },
  ]) {
    const raw = JSON.stringify({ ...valid, active: { ...valid.active, responses: [response] } });
    let writes = 0;
    const repo = createRepository({ getItem: async () => raw, setItem: async () => { writes++; } });
    await assert.rejects(repo.load(), /saved practice/i);
    assert.equal(writes, 0);
  }
});
