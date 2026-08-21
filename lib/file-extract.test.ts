import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./file-extract.ts", import.meta.url), "utf8");

test("document extraction uses the 25MB contract and a bundled same-origin PDF worker", () => {
  assert.match(source, /25 \* 1024 \* 1024/);
  assert.match(source, /Maximum size is 25MB/);
  assert.match(source, /new URL\([\s\S]*pdfjs-dist\/build\/pdf\.worker\.min\.mjs[\s\S]*import\.meta\.url/);
  assert.doesNotMatch(source, /cdnjs|https:\/\/.*pdf\.worker/);
});
