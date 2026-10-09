import assert from 'node:assert/strict';
import { lessonIdFromVisualFilename } from './lib/encyclopedia-visual-filename.mjs';

const valid = new Map([
  ['THC-ENC-001_01_core-concept-overview.png', 'THC-ENC-001'],
  ['thc-enc-420_10_summary-reference-graphic.PNG', 'THC-ENC-420'],
  ['THC-ENC-1000_01_core-concept-overview.webp', 'THC-ENC-1000'],
  ['THC-ENC-12345.jpeg', 'THC-ENC-12345']
]);
for (const [filename, id] of valid) assert.equal(lessonIdFromVisualFilename(filename), id);
for (const filename of [
  'THC-ENC-1000.png.txt', 'THC-ENC-10_01.png', 'THC-ENC-1000extra.png',
  'THC-ENC-1000-evil.png', 'OTHER-ENC-1000.png', 'THC-ENC-1000.svg'
]) assert.equal(lessonIdFromVisualFilename(filename), null, filename);
assert.equal(lessonIdFromVisualFilename(null), null);
console.log('Extended encyclopedia visual filename tests passed');
