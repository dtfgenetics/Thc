import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const expected = Object.freeze({ width: 1600, height: 640, columns: 5, rows: 2 });
const paths = [
  new URL('../games/seed-man-platformer/assets/approved/seed-man-character-atlas-v2.webp', import.meta.url),
  new URL('../site/public-route-patch/games/seed-man-platformer/assets/approved/seed-man-character-atlas-v2.webp', import.meta.url)
];

function inspectWebp(buffer) {
  assert.equal(buffer.subarray(0, 4).toString('ascii'), 'RIFF', 'missing RIFF signature');
  assert.equal(buffer.subarray(8, 12).toString('ascii'), 'WEBP', 'missing WEBP signature');
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'VP8X', 'atlas must use extended WebP');
  const flags = buffer[20];
  const width = 1 + buffer.readUIntLE(24, 3);
  const height = 1 + buffer.readUIntLE(27, 3);
  return { width, height, alpha: Boolean(flags & 0x10) || buffer.includes(Buffer.from('ALPH')) };
}

const files = await Promise.all(paths.map((path) => readFile(path)));
for (const file of files) {
  assert.ok(file.length > 100_000, 'atlas is suspiciously small or truncated');
  assert.deepEqual(inspectWebp(file), { width: expected.width, height: expected.height, alpha: true });
  assert.equal(expected.width % expected.columns, 0, 'frame columns must divide evenly');
  assert.equal(expected.height % expected.rows, 0, 'frame rows must divide evenly');
}
const hashes = files.map((file) => createHash('sha256').update(file).digest('hex'));
assert.equal(hashes[0], hashes[1], 'canonical and public character atlases must be byte-identical');
console.log(`Seed Man character atlas OK: ${expected.width}x${expected.height}, alpha, sha256 ${hashes[0]}`);
