import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QrCode } from "../components/shared/qr-code";

Object.assign(globalThis, { React });

// Import inside the test so a missing local generation path is an explicit RED.
async function localGenerator() {
  const module = await import("./qr-code").catch(() => null);
  assert.ok(module, "Local QR SVG generation must be implemented");
  return module.generateQrSvg;
}

test("join URLs produce a local, scalable SVG without network resources", async () => {
  const generateQrSvg = await localGenerator();
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = (() => {
    fetches += 1;
    throw new Error("QR generation must not fetch");
  }) as typeof fetch;
  try {
    const svg = await generateQrSvg("https://www.quizworld.xyz/join?pin=123456");
    assert.match(svg, /<svg\b/);
    assert.match(svg, /width="100%"/);
    assert.match(svg, /height="100%"/);
    assert.doesNotMatch(svg, /qrserver|(?:src|href)=["']https?:|fetch\s*\(/i);
    // The standard SVG xmlns URI is a namespace, not an HTTP request.
    assert.equal(fetches, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("pending client generation reserves both lobby sizes with an accessible empty box", () => {
  for (const size of [160, 260]) {
    const html = renderToStaticMarkup(React.createElement(QrCode, {
      value: "https://www.quizworld.xyz/join?pin=123456",
      size,
      label: "Join this room",
      className: "qr-code",
    }));
    assert.equal(html, `<div role="img" aria-label="Join this room" class="qr-code" style="width:${size}px;height:${size}px"></div>`);
  }
});

test("browser-target generation encodes presentation URLs and untrusted text without loading resources", async () => {
  const bundle = await build({
    entryPoints: ["lib/qr-code.ts"], bundle: true, write: false,
    platform: "browser", format: "iife", globalName: "localQr",
  });
  let fetches = 0;
  const context = {
    TextEncoder,
    fetch() { fetches += 1; throw new Error("No network allowed"); },
    localQr: {} as { generateQrSvg: (value: string) => Promise<string> },
  };
  runInNewContext(bundle.outputFiles[0].text, context);
  for (const value of ["https://www.quizworld.xyz/present/join?code=123456", '<script>alert("unsafe")</script>']) {
    const svg = await context.localQr.generateQrSvg(value);
    assert.match(svg, /<svg\b/);
    assert.doesNotMatch(svg, /qrserver|<script|<image|<foreignObject|(?:src|href)=["']https?:/i);
  }
  assert.equal(fetches, 0);
});

test("invalid or oversized QR values reject so the component can show its text fallback", async () => {
  const generateQrSvg = await localGenerator();
  await assert.rejects(generateQrSvg(""));
  await assert.rejects(generateQrSvg("a".repeat(10000)));
});

test("application source contains no third-party QR service references", () => {
  const forbiddenHost = ["api", "qrserver", "com"].join(".");
  const violations: string[] = [];
  function visit(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && readFileSync(path, "utf8").includes(forbiddenHost)) violations.push(path);
    }
  }
  for (const directory of ["app", "components", "lib"]) visit(directory);
  assert.deepEqual(violations, [], "Join URLs must never be sent to a third-party QR service");
});
