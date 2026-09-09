const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

for (const recovered of [true, false]) {
  test(`real Playwright ${recovered ? 'recovery' : 'terminal failure'} retains only safe evidence`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qw-evidence-'));
    try {
      const reporter = path.resolve(__dirname, 'e2e-evidence-reporter.cjs');
      assert.ok(fs.existsSync(reporter), 'safe evidence reporter must exist');
      const playwright = require.resolve('@playwright/test');
      fs.writeFileSync(path.join(dir, 'fixture.spec.cjs'), `
        const { test, expect } = require(${JSON.stringify(playwright)});
        test('PRIVATE_TITLE_SENTINEL', async ({}, info) => {
          console.log('PRIVATE_STDOUT_SENTINEL');
          console.error('PRIVATE_STDERR_SENTINEL');
          await info.attach('PRIVATE_ATTACHMENT_SENTINEL', { body: Buffer.from('PRIVATE_BODY_SENTINEL'), contentType: 'text/plain' });
          expect(info.retry, 'PRIVATE_ERROR_SENTINEL').toBe(${recovered ? 1 : 99});
        });
        test('passes', async () => {});
        test.skip('skipped', async () => {});
      `);
      fs.writeFileSync(path.join(dir, 'playwright.config.cjs'), `module.exports = {
        testDir: '.', retries: 1, workers: 1,
        reporter: [[${JSON.stringify(reporter)}]],
        outputDir: './raw-results'
      };`);
      const run = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--config', path.join(dir, 'playwright.config.cjs')], {
        cwd: dir, encoding: 'utf8', timeout: 30000,
        env: { ...process.env, CI: '1' },
      });
      assert.equal(run.status, recovered ? 0 : 1, run.stdout + run.stderr);
      const raw = fs.readFileSync(path.join(dir, 'e2e-evidence/summary.json'), 'utf8');
      assert.doesNotMatch(raw, /PRIVATE_|raw-results|attachments|stdout|stderr|errors/);
      const summary = JSON.parse(raw);
      assert.deepEqual(Object.keys(summary).sort(), ['schemaVersion', 'status', 'tests']);
      assert.equal(summary.schemaVersion, 1);
      assert.equal(summary.status, recovered ? 'passed' : 'failed');
      assert.equal(summary.tests.length, 3);
      assert.deepEqual(summary.tests.map(t => t.outcome), [recovered ? 'flaky' : 'unexpected', 'expected', 'skipped']);
      assert.deepEqual(summary.tests[0].attempts.map(({ retry, status }) => ({ retry, status })), [
        { retry: 0, status: 'failed' }, { retry: 1, status: recovered ? 'passed' : 'failed' },
      ]);
      for (const record of summary.tests) {
        assert.deepEqual(Object.keys(record).sort(), ['attempts', 'column', 'file', 'id', 'line', 'outcome']);
        assert.equal(record.file, 'fixture.spec.cjs');
        assert.ok(Number.isInteger(record.line) && record.line > 0);
        for (const attempt of record.attempts) {
          assert.deepEqual(Object.keys(attempt).sort(), ['durationMs', 'parallelIndex', 'retry', 'status', 'workerIndex']);
          assert.ok(Number.isFinite(attempt.durationMs) && attempt.durationMs >= 0);
        }
      }
      assert.deepEqual(fs.readdirSync(path.join(dir, 'e2e-evidence')), ['summary.json']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('CI uploads only the safe summary for success and failure, not skipped E2E', () => {
  const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/ci.yml'), 'utf8');
  const upload = workflow.slice(workflow.indexOf('      - name: Upload safe E2E evidence'));
  assert.match(upload, /if: always\(\).*steps\.e2e\.outcome == 'success' \|\| steps\.e2e\.outcome == 'failure'/);
  assert.match(upload, /github\.event_name == 'push'.*github\.ref == 'refs\/heads\/main'/);
  assert.match(upload, /path: e2e-evidence\/summary\.json\n/);
  assert.match(upload, /if-no-files-found: error/);
  assert.doesNotMatch(upload, /playwright-report|test-results|\.zip|\.png/);
  assert.match(workflow, /name: Run production E2E tests\n        id: e2e/);
});
