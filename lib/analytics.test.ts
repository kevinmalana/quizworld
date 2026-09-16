import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsPage } from './analytics';

test('analytics fails closed until adult consent and anonymous auth resolution', () => {
  assert.equal(analyticsPage('/', null, false, false), null);
  assert.equal(analyticsPage('/', 'denied', false, false), null);
  assert.equal(analyticsPage('/', 'adult-granted', true, false), null);
  assert.equal(analyticsPage('/', 'adult-granted', false, true), null);
  assert.equal(analyticsPage('/', 'adult-granted', false, false), 'home');
  for (const path of ['/join', '/login', '/explore', '/quiz/secret', '/game/123456', '/study', '/study/secret', '/solo/secret', '/report/secret', '/classrooms', '/groups', '/dashboard', '/profile', '/u/student', '/create', '/present', '/admin', '/__proto__', '__proto__', '/?email=child@example.com', '/#SECRET', '/%2e%2e/game/secret']) {
    assert.equal(analyticsPage(path, 'adult-granted', false, false), null, path);
  }
  assert.equal(analyticsPage('/kahoot-alternative', 'adult-granted', false, false), 'kahoot_alternative');
  assert.equal(analyticsPage('/aws-practice-test', 'adult-granted', false, false), 'aws_practice_test');
});
