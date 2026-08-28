import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");

test("the declared and CI Node runtimes satisfy production dependency requirements", () => {
  const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as {
    engines?: { node?: string };
  };
  const workflow = readFileSync(resolve(repoRoot, ".github/workflows/ci.yml"), "utf8");
  const readme = readFileSync(resolve(repoRoot, "README.md"), "utf8");

  assert.equal(packageJson.engines?.node, ">=22.19.0");
  assert.match(workflow, /node-version:\s*['"]22\.19\.0['"]/);
  assert.match(readme, /Node\.js 22\.19\.0\+/);
});
