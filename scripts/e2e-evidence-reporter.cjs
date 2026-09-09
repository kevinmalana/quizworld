const fs = require('node:fs');
const path = require('node:path');

// Public CI artifact: allowlist metadata, never serialize Playwright objects.
// In particular, titles, errors, steps, attachments, stdout, URLs, environment,
// traces and storage state can contain credentials or private user content.
class EvidenceReporter {
  onBegin(config, suite) {
    this.output = path.resolve('e2e-evidence/summary.json');
    this.records = new Map();
    this.summary = { schemaVersion: 1, status: 'running', tests: [] };
    for (const test of suite.allTests()) {
      const record = {
        id: this.records.size + 1,
        file: path.relative(config.rootDir, test.location.file).split(path.sep).join('/'),
        line: test.location.line,
        column: test.location.column,
        outcome: 'pending',
        attempts: [],
      };
      this.records.set(test, record);
      this.summary.tests.push(record);
    }
    fs.mkdirSync(path.dirname(this.output), { recursive: true });
    this.flush();
  }

  onTestEnd(test, result) {
    this.records.get(test).attempts.push({
      retry: result.retry,
      status: result.status,
      durationMs: result.duration,
      workerIndex: result.workerIndex,
      parallelIndex: result.parallelIndex,
    });
    // Write after each attempt so a later interruption need not lose evidence.
    this.flush();
  }

  onEnd(result) {
    this.summary.status = result.status;
    for (const [test, record] of this.records) record.outcome = test.outcome();
    this.flush();
  }

  flush() {
    fs.writeFileSync(this.output, JSON.stringify(this.summary, null, 2) + '\n');
  }
}

module.exports = EvidenceReporter;
