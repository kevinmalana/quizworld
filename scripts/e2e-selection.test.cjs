const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const localFiles = ['navigation-boundaries.spec.ts', 'ux-polish.spec.ts'];
function inventory(args = [], env = {}) {
  const run = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--list', '--reporter=json', ...args], {
    cwd: root, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, BASE_URL: 'https://www.quizworld.xyz', ...env },
  });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const report = JSON.parse(run.stdout);
  const cases = [];
  function visit(suites, parents = []) {
    for (const suite of suites) {
      for (const spec of suite.specs || []) {
        for (const item of spec.tests) cases.push({
          key: JSON.stringify([spec.file, spec.line, spec.column, ...parents, suite.title, spec.title]),
          file: spec.file, skipped: item.expectedStatus === 'skipped',
        });
      }
      visit(suite.suites || [], [...parents, suite.title]);
    }
  }
  visit(report.suites);
  return { cases, config: report.config };
}
const keys = cases => cases.map(item => item.key).sort();

test('production and local projects partition every existing case without skips or duplicates', () => {
  const all = inventory();
  const production = inventory(['--project=chromium']);
  assert.equal(all.cases.length, 311);
  assert.equal(production.cases.length, 274);
  const local = inventory(['--config=playwright.local.config.ts', '--project=local-fixtures']);
  assert.equal(local.cases.length, 37);
  assert.equal(new Set(keys(all.cases)).size, 311);
  assert.deepEqual(keys([...production.cases, ...local.cases]), keys(all.cases));
  assert.deepEqual(keys(local.cases), keys(all.cases.filter(item => localFiles.includes(item.file))));
  assert.equal(production.cases.filter(item => localFiles.includes(item.file)).length, 0);
  assert.equal(local.cases.filter(item => item.file === localFiles[0]).length, 33);
  assert.equal(local.cases.filter(item => item.file === localFiles[1]).length, 4);
  assert.equal(local.cases.filter(item => item.skipped).length, 0);
  // --list exposes static skips; the 12 controlled-reconnect cases also
  // skip at runtime without explicitly authorized session evidence.
  assert.equal(production.cases.filter(item => item.skipped).length, 18);
  assert.equal(production.cases.filter(item => item.file === 'controlled-reconnect.spec.ts').length, 12);
});

function steps() {
  return fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')
    .split(/(?=      - name: )/);
}

test('CI runs the built loopback fixture gate on PRs before explicitly selected public E2E', () => {
  const workflowSteps = steps();
  const localIndex = workflowSteps.findIndex(step => step.includes('name: Run local fixture E2E tests\n'));
  const publicIndex = workflowSteps.findIndex(step => step.includes('name: Run production E2E tests\n'));
  const buildIndex = workflowSteps.findIndex(step => step.includes('run: npm run check\n'));
  assert.ok(localIndex > buildIndex && localIndex < publicIndex, 'built local gate must precede production E2E');
  const local = workflowSteps[localIndex];
  const production = workflowSteps[publicIndex];
  assert.doesNotMatch(local, /\n        if:/, 'local gate runs on PRs and pushes, fails closed');
  assert.match(workflowSteps[buildIndex], /NEXT_PUBLIC_GAME_SERVICE_URL: https:\/\/quizworld-ux-test\.invalid/);
  assert.match(production, /if: github.event_name == 'push' && github.ref == 'refs\/heads\/main'/);
  assert.match(production, /BASE_URL: https:\/\/www\.quizworld\.xyz/);
  for (const [step, expectedCount, expectedFile] of [[local, 37, true], [production, 274, false]]) {
    const command = step.match(/        run: npx playwright test([^\n]*)/);
    assert.ok(command, 'workflow uses an explicit Playwright invocation');
    const selected = inventory(command[1].trim().split(/\s+/)).cases;
    assert.equal(selected.length, expectedCount);
    assert.equal(selected.filter(item => localFiles.includes(item.file)).length, expectedFile ? 37 : 0);
    assert.doesNotMatch(step, /continue-on-error|--pass-with-no-tests|--grep-invert/);
  }
  assert.ok(workflowSteps.some(step => step.includes('node --test scripts/e2e-selection.test.cjs')));
});

test('both evidence uploads retain only safe summaries with distinct artifact names', () => {
  const uploads = steps().filter(step => step.includes('uses: actions/upload-artifact@v4'));
  assert.equal(uploads.length, 2);
  for (const [index, step] of uploads.entries()) {
    const id = index === 0 ? 'local_e2e' : 'e2e';
    assert.ok(step.includes(`if: always() &&`));
    assert.ok(step.includes(`steps.${id}.outcome == 'success' || steps.${id}.outcome == 'failure'`));
    assert.match(step, /path: e2e-evidence\/summary\.json\n/);
    assert.match(step, /if-no-files-found: error\n/);
    assert.match(step, /retention-days: 7(?:\n|$)/);
    assert.doesNotMatch(step, /playwright-report|test-results|\.zip|\.png|continue-on-error/);
    assert.ok(step.includes(`name: ${index === 0 ? 'local-' : ''}e2e-evidence\n`));
  }
});

test('local configuration cannot inherit a production URL and owns loopback server lifecycle', () => {
  const run = spawnSync(process.execPath, ['--import', 'tsx', '-e',
    "const main=require('./playwright.config.ts').default; const local=require('./playwright.local.config.ts').default; console.log(JSON.stringify({main,local}));"], {
    cwd: root, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, CI: '1', BASE_URL: 'https://www.quizworld.xyz', LOCAL_FIXTURE_BASE_URL: 'http://127.0.0.1:3000' },
  });
  assert.equal(run.status, 0, run.stderr);
  const { main, local } = JSON.parse(run.stdout);
  assert.equal(main.webServer, undefined);
  assert.equal(main.projects.find(project => project.name === 'local-fixtures').use.baseURL, 'http://127.0.0.1:3000');
  assert.deepEqual(local.projects.map(project => project.name), ['local-fixtures']);
  assert.equal(local.webServer.url, 'http://127.0.0.1:3000/join');
  assert.equal(local.webServer.command, 'npm run start -- --hostname 127.0.0.1 --port 3000');
  assert.equal(local.webServer.reuseExistingServer, false);
  assert.equal(local.workers, 1);
  for (const url of ['https://www.quizworld.xyz', 'http://127.0.0.1.evil.example', 'http://user:secret@localhost:3000', 'http://localhost:3000/path']) {
    const invalid = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--list', '--project=local-fixtures'], {
      cwd: root, encoding: 'utf8', timeout: 30000,
      env: { ...process.env, LOCAL_FIXTURE_BASE_URL: url },
    });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /LOCAL_FIXTURE_BASE_URL must be an HTTP loopback origin/);
  }
});

