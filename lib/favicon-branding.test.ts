import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url));

test("favicon uses the header's outlined Bricolage Q and current palette", () => {
  const svg = read("public/favicon.svg").toString();
  const css = read("app/globals.css").toString();
  const navigation = read("components/navigation.tsx").toString();
  assert.match(navigation, /className="logo-quiz">Quiz<\/span>/);
  assert.match(css, /font-family: "Bricolage"/);
  assert.match(css, /\.nav-logo\s*\{[^}]*font-weight: 800/);
  assert.match(svg, /viewBox="0 0 32 32"/);
  assert.match(svg, /<path fill="#172c4b" d="M/);
  for (const color of ["#172c4b", "#f3f6fc", "#78869b"]) {
    assert.ok(svg.includes(color));
    assert.ok(css.includes(color));
  }
  assert.doesNotMatch(svg, /<text|<image|#7c3aed|href=/);
});

test("ICO contains real 16, 32 and 48 pixel frames", () => {
  const ico = read("public/favicon.ico");
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  const sizes: number[] = [];
  for (let i = 0; i < 3; i++) {
    const pos = 6 + i * 16;
    assert.equal(ico[pos], ico[pos + 1]);
    sizes.push(ico[pos]);
    const length = ico.readUInt32LE(pos + 8);
    const offset = ico.readUInt32LE(pos + 12);
    assert.ok(offset >= 54 && length > 0 && offset + length <= ico.length);
    assert.equal(ico.subarray(offset + 1, offset + 4).toString(), "PNG");
    assert.equal(ico.readUInt32BE(offset + 16), ico[pos]);
    assert.equal(ico.readUInt32BE(offset + 20), ico[pos]);
  }
  assert.deepEqual(sizes, [16, 32, 48]);
});

test("Apple icon is 180px and metadata cache-busts each icon", () => {
  const png = read("public/apple-touch-icon.png");
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 180);
  assert.equal(png.readUInt32BE(20), 180);
  const layout = read("app/layout.tsx").toString();
  for (const asset of ["favicon.ico", "favicon.svg", "apple-touch-icon.png"]) {
    assert.ok(layout.includes(`/${asset}?v=wordmark-1`));
  }
});
