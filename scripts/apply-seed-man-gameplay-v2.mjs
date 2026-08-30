import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, text); }
function must(condition, message) { if (!condition) throw new Error(message); }
function replaceOnce(text, from, to, label) {
  if (text.includes(to)) return text;
  must(text.includes(from), `Could not patch ${label}`);
  return text.replace(from, to);
}

const indexPath = 'site/public-route-patch/games/seed-man-platformer/index.html';
let index = read(indexPath);
const releaseMatch = index.match(/name="dtf-sprout-release" content="(\d{8})-r(\d+)"/);
must(releaseMatch, 'Seed Man release marker missing');
const currentRelease = `${releaseMatch[1]}-r${releaseMatch[2]}`;
const nextRelease = `${releaseMatch[1]}-r${Number(releaseMatch[2]) + 1}`;
index = index.split(currentRelease).join(nextRelease);
index = replaceOnce(
  index,
  `<script src="./seed-man-production-art.js?v=${nextRelease}" defer></script>\n  <script src="./input-guard-v1.js?v=${nextRelease}" defer></script>`,
  `<script src="./seed-man-production-art.js?v=${nextRelease}" defer></script>\n  <script src="./gameplay-v2.js?v=${nextRelease}" defer></script>\n  <script src="./input-guard-v1.js?v=${nextRelease}" defer></script>`,
  'gameplay-v2 script tag'
);
index = index.replace(
  'collect all 24 sprouts, use responsive short-hop/full-height jumps, double jumps and power-ups, activate three checkpoints, and reach the Dream the Future flag.',
  'collect all 24 sprouts, ride moving greenhouse tables, stomp roaming pests, hit boost pads, use responsive short-hop/full-height jumps, double jumps and power-ups, activate three checkpoints, and reach the Dream the Future flag.'
);
index = index.replace(
  '<strong>Power-ups:</strong> gold = speed, green = high jump, purple = sprout magnet, blue = hazard shield.',
  '<strong>Gameplay:</strong> stomp pests from above, use BOOST pads for high routes, and time moving greenhouse platforms. <strong>Power-ups:</strong> gold = speed, green = high jump, purple = sprout magnet, blue = hazard shield.'
);
write(indexPath, index);

const compatPath = 'site/public-route-patch/games/seed-man-platformer/canvas-compat-v1.js';
let compat = read(compatPath);
compat = compat.replace(/const RELEASE = '\d{8}-r\d+';/, `const RELEASE = '${nextRelease}';`);
write(compatPath, compat);

const publisherPath = 'scripts/publish-seed-man-route-via-wordpress.mjs';
let publisher = read(publisherPath);
publisher = replaceOnce(
  publisher,
  "'seed-man-production-art.js','input-guard-v1.js'",
  "'seed-man-production-art.js','gameplay-v2.js','input-guard-v1.js'",
  'publisher gameplay file manifest'
);
publisher = publisher.replace(
  "'/games/seed-man-platformer/seed-man-production-art.js','/games/seed-man-platformer/input-guard-v1.js'",
  "'/games/seed-man-platformer/seed-man-production-art.js','/games/seed-man-platformer/gameplay-v2.js','/games/seed-man-platformer/input-guard-v1.js'"
);
write(publisherPath, publisher);

console.log(JSON.stringify({
  currentRelease,
  nextRelease,
  patched: [indexPath, compatPath, publisherPath],
  gameplayFile: 'site/public-route-patch/games/seed-man-platformer/gameplay-v2.js'
}, null, 2));