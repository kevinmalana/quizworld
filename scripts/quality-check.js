#!/usr/bin/env node

const { execSync } = require("node:child_process");
const { existsSync, readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");
const ts = require("typescript");

function sh(command) {
  return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function count(command) {
  const output = sh(command);
  return Number(output) || 0;
}

const limits = {
  // Ratchets: these values match the audited baseline. Refactors should lower
  // them; feature work must not raise them without an explicit review.
  inlineStyles: 571,
  typeEscapes: 18,
  fixedE2EWaits: 75,
  literalTrueAssertions: 0,
  routeFiles: {
    "app/game/[pin]/page.tsx": 1120,
    "app/create/page.tsx": 618,
    "app/dashboard/page.tsx": 641,
    "app/present/[code]/live/page.tsx": 457,
    "app/profile/page.tsx": 429,
    "app/report/[pin]/page.tsx": 441,
    "app/explore/page.tsx": 1025,
    "app/join/page.tsx": 350,
    "app/host/page.tsx": 542,
  },
};

const failures = [];

const inlineStyles = count("rg -n 'style=\\{\\{' app components --glob '*.tsx' | wc -l");
if (inlineStyles > limits.inlineStyles) {
  failures.push(`Inline style count increased: ${inlineStyles} > ${limits.inlineStyles}. Move styling into CSS/classes or shared components.`);
}

const typeEscapes = count("rg -n '(^|[^[:alnum:]_])(as any|: any\\b|<any>)' app components lib --glob '*.{ts,tsx}' | wc -l");
if (typeEscapes > limits.typeEscapes) {
  failures.push(`Type escape count increased: ${typeEscapes} > ${limits.typeEscapes}. Add a concrete type instead.`);
}

const fixedE2EWaits = count("rg -n 'waitForTimeout\\(' e2e --glob '*.spec.ts' | wc -l");
if (fixedE2EWaits > limits.fixedE2EWaits) {
  failures.push(`Fixed E2E wait count increased: ${fixedE2EWaits} > ${limits.fixedE2EWaits}. Wait on observable state instead.`);
}

const literalTrueAssertions = count("rg -n 'expect\\(true\\)\\.toBe\\(true\\)' e2e --glob '*.spec.ts' | wc -l");
if (literalTrueAssertions > limits.literalTrueAssertions) {
  failures.push(`Found ${literalTrueAssertions} literal true E2E assertions. Assert user-visible behaviour instead.`);
}

const vacuousAssertionPatterns = [
  { pattern: /expect\(page\.locator\(["']body["']\)\)\.toBeVisible/g, label: "body-only visibility" },
  { pattern: /expect\((?:page\.url\(\)|url)\)\.toBeDefined/g, label: "URL-is-defined" },
  { pattern: /expect\(bodyText\)\.toBeDefined/g, label: "body-text-is-defined" },
];

const e2eFiles = readdirSync("e2e")
  .filter((file) => file.endsWith(".spec.ts"))
  .map((file) => join("e2e", file));

let activeE2ETests = 0;
let assertionlessE2ETests = 0;
let vacuousE2EAssertions = 0;

for (const file of e2eFiles) {
  const sourceText = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);

  for (const { pattern, label } of vacuousAssertionPatterns) {
    const matches = sourceText.match(pattern) ?? [];
    vacuousE2EAssertions += matches.length;
    if (matches.length > 0) {
      failures.push(`${file} contains ${matches.length} ${label} assertion(s). Assert concrete behaviour instead.`);
    }
  }

  function visit(node) {
    const isActiveTest =
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "test";

    if (isActiveTest) {
      activeE2ETests += 1;
      const body = node.arguments[1];
      let hasAssertion = false;

      function findAssertion(child) {
        if (
          ts.isCallExpression(child) &&
          ts.isIdentifier(child.expression) &&
          child.expression.text.startsWith("expect")
        ) {
          hasAssertion = true;
        }
        ts.forEachChild(child, findAssertion);
      }

      if (body) findAssertion(body);
      if (!hasAssertion) {
        assertionlessE2ETests += 1;
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        failures.push(`${file}:${line} has an active test with no assertion or expect* assertion helper.`);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

for (const [file, maxLines] of Object.entries(limits.routeFiles)) {
  if (!existsSync(file)) continue;
  const lines = count(`wc -l < '${file}'`);
  if (lines > maxLines) {
    failures.push(`${file} is ${lines} lines, above limit ${maxLines}. Extract route logic/UI before adding more.`);
  }
}

const duplicatePhoenixRoots = count("find .. -maxdepth 2 -type d -name quizworld_realtime | wc -l");
if (duplicatePhoenixRoots > 1) {
  failures.push(`Found ${duplicatePhoenixRoots} quizworld_realtime directories near repo. Active backend must remain services/quizworld_realtime only.`);
}

if (failures.length) {
  console.error("Quality guard failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("\nIf a limit must change, update scripts/quality-check.js with a clear reason in the commit.");
  process.exit(1);
}

console.log("Quality guard passed.");
console.log(
  `inline_styles=${inlineStyles} type_escapes=${typeEscapes} fixed_e2e_waits=${fixedE2EWaits} ` +
    `active_e2e_tests=${activeE2ETests} assertionless_e2e_tests=${assertionlessE2ETests} ` +
    `vacuous_e2e_assertions=${vacuousE2EAssertions} literal_true_assertions=${literalTrueAssertions}`
);
