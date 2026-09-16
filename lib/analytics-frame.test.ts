import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function frame() {
  const scripts: unknown[] = [];
  const parent = {};
  let receive: (event: unknown) => void = () => {};
  const window = { parent, location: { origin: 'https://www.quizworld.xyz' }, addEventListener: (_: string, fn: typeof receive) => { receive = fn; }, dataLayer: [] as unknown[][] };
  const context = vm.createContext({ window, document: { createElement: () => ({}), head: { appendChild: (s: unknown) => scripts.push(s) } }, Date });
  vm.runInContext(readFileSync('public/analytics-frame.js', 'utf8'), context);
  return { scripts, commands: window.dataLayer, send: (data: unknown, source: unknown = parent) => receive({ data, source, origin: window.location.origin }) };
}

test('frame is inert until validated parent message and never accepts URL/title/parameters', () => {
  const f = frame();
  assert.equal(f.scripts.length, 0);
  f.send({ page: 'home' }, {});
  f.send({ page: '__proto__' });
  f.send({ page: '/game/SECRET?email=child@example.com#answer' });
  assert.equal(f.scripts.length, 0);
  f.send({ page: 'home', title: 'child@example.com', url: '/game/SECRET', answer: 'PRIVATE' });
  assert.equal(f.scripts.length, 1);
  assert.doesNotMatch(JSON.stringify(f.commands), /child@|SECRET|PRIVATE|answer|\/game/);
  const config = Array.from(f.commands.find(c => c[0] === 'config')!);
  assert.equal(config[1], 'G-1YJEL65QPS');
  const options = config[2] as Record<string, unknown>;
  assert.equal(options.send_page_view, false);
  assert.equal(options.allow_google_signals, false);
  assert.equal(options.allow_ad_personalization_signals, false);
  assert.equal(options.page_referrer, '');
  assert.equal(options.cookie_domain, 'none');
});

test('manual pageviews dedupe repeats, preserve transitions, reject arbitrary events', () => {
  const f = frame();
  f.send({ page: 'home' });
  f.send({ page: 'home' });
  f.send({ event: 'quiz_answer', page: 'home', value: 'private' });
  f.send({ page: 'kahoot_alternative' });
  f.send({ page: 'home' });
  assert.deepEqual(Array.from(f.commands).filter(c => c[0] === 'event').map(c => c[1]), ['page_view', 'page_view', 'page_view']);
  assert.doesNotMatch(JSON.stringify(f.commands), /quiz_answer|private/);
});
