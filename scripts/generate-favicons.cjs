// Regenerate raster icons from the outlined header Q in public/favicon.svg.
// sharp is supplied by Next.js; no font or network dependency is needed.
// Run from the repository root: node scripts/generate-favicons.cjs
const sharp = require('sharp');
const { writeFile } = require('node:fs/promises');

async function main() {
  const sizes = [16, 32, 48];
  const frames = await Promise.all(sizes.map(size =>
    sharp('public/favicon.svg').resize(size, size).png().toBuffer()));
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  frames.forEach((frame, i) => {
    const entry = 6 + 16 * i;
    header[entry] = header[entry + 1] = sizes[i];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frame.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frame.length;
  });
  await writeFile('public/favicon.ico', Buffer.concat([header, ...frames]));
  // Apple touch icons should be opaque, including their corner pixels.
  await sharp('public/favicon.svg').resize(180, 180)
    .flatten({ background: '#f3f6fc' }).png().toFile('public/apple-touch-icon.png');
  console.log('Generated favicon.ico (16/32/48) and apple-touch-icon.png (180).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
