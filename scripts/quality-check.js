#!/usr/bin/env node

const { execSync } = require("node:child_process");
const { existsSync } = require("node:fs");

function sh(command) {
  return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function count(command) {
  const output = sh(command);
  return Number(output) || 0;
}

const limits = {
  inlineStyles: 218,
  anyCount: 42, // string literal 'any' in XP guide + study session panels
  routeFiles: {
    "app/game/[pin]/page.tsx": 960,
    "app/create/page.tsx": 600,
    "app/dashboard/page.tsx": 450,
    "app/present/[code]/live/page.tsx": 440,
    "app/profile/page.tsx": 390, // added Classrooms quick link card (+8 lines)
    "app/report/[pin]/page.tsx": 370,
    "app/explore/page.tsx": 345, // creator level fields added to profile fetch (+3 lines)
    "app/join/page.tsx": 290,
    "app/host/page.tsx": 280,
  },
};

const failures = [];

const inlineStyles = count("rg -n 'style=\\{\\{' app components --glob '*.tsx' | wc -l");
if (inlineStyles > limits.inlineStyles) {
  failures.push(`Inline style count increased: ${inlineStyles} > ${limits.inlineStyles}. Move styling into CSS/classes or shared components.`);
}

const anyCount = count("rg -n '\\bany\\b|as any|: any' app components lib --glob '*.{ts,tsx}' | wc -l");
if (anyCount > limits.anyCount) {
  failures.push(`Type escape count increased: ${anyCount} > ${limits.anyCount}. Add typed adapters instead of new any usage.`);
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
console.log(`inline_styles=${inlineStyles} any_count=${anyCount}`);
