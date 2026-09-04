import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, text); }
function must(condition, message) { if (!condition) throw new Error(message); }
function escapeRegex(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const indexPath = 'site/public-route-patch/games/seed-man-platformer/index.html';
const compatPath = 'site/public-route-patch/games/seed-man-platformer/canvas-compat-v1.js';
const publisherPath = 'scripts/publish-seed-man-route-via-wordpress.mjs';

const originalIndex = read(indexPath);
const originalCompat = read(compatPath);
const originalPublisher = read(publisherPath);

let index = originalIndex;
let publisher = originalPublisher;

const releaseMatch = index.match(/name="dtf-sprout-release" content="(\d{8})-r(\d+)"/);
must(releaseMatch, 'Seed Man release marker missing');
const currentRelease = `${releaseMatch[1]}-r${releaseMatch[2]}`;
const nextRelease = `${releaseMatch[1]}-r${Number(releaseMatch[2]) + 1}`;

const gameplayTag = `<script src="./gameplay-v2.js?v=${currentRelease}" defer></script>`;
if (!index.includes(gameplayTag)) {
  const anchor = `<script src="./seed-man-production-art.js?v=${currentRelease}" defer></script>\n  <script src="./input-guard-v1.js?v=${currentRelease}" defer></script>`;
  must(index.includes(anchor), 'Could not locate Seed Man gameplay script insertion point');
  index = index.replace(
    anchor,
    `<script src="./seed-man-production-art.js?v=${currentRelease}" defer></script>\n  ${gameplayTag}\n  <script src="./input-guard-v1.js?v=${currentRelease}" defer></script>`
  );
}

const oldLede = 'collect all 24 sprouts, use responsive short-hop/full-height jumps, double jumps and power-ups, activate three checkpoints, and reach the Dream the Future flag.';
const canonicalLede = 'collect all 24 sprouts, ride moving greenhouse tables, stomp roaming pests, hit boost pads, use responsive short-hop/full-height jumps, double jumps and power-ups, activate three checkpoints, and reach the Dream the Future flag.';
if (index.includes(oldLede)) index = index.replace(oldLede, canonicalLede);
must(index.includes(canonicalLede), 'Seed Man gameplay-v2 lede is not canonical');

const gameplayCopy = '<strong>Gameplay:</strong> stomp pests from above, use BOOST pads for high routes, and time moving greenhouse platforms. ';
const powerupCopy = '<strong>Power-ups:</strong> gold = speed, green = high jump, purple = sprout magnet, blue = hazard shield.';
const repeatedGameplay = new RegExp(`(?:${escapeRegex(gameplayCopy)})+${escapeRegex(powerupCopy)}`, 'g');
index = index.replace(repeatedGameplay, `${gameplayCopy}${powerupCopy}`);
must(index.includes(`${gameplayCopy}${powerupCopy}`), 'Seed Man gameplay-v2 control copy is not canonical');

if (!publisher.includes("'gameplay-v2.js'")) {
  const publisherAnchor = "  'seed-man-production-art.js',\n  'input-guard-v1.js',";
  must(publisher.includes(publisherAnchor), 'Could not locate publisher gameplay file insertion point');
  publisher = publisher.replace(
    publisherAnchor,
    "  'seed-man-production-art.js',\n  'gameplay-v2.js',\n  'input-guard-v1.js',"
  );
}
must(publisher.includes("'gameplay-v2.js'"), 'Seed Man publisher does not include gameplay-v2.js');

const contentChanged = index !== originalIndex || publisher !== originalPublisher;
if (!contentChanged) {
  console.log(JSON.stringify({
    currentRelease,
    nextRelease: currentRelease,
    changed: false,
    reason: 'gameplay-v2 already canonical',
    gameplayFile: 'site/public-route-patch/games/seed-man-platformer/gameplay-v2.js'
  }, null, 2));
  process.exit(0);
}

index = index.split(currentRelease).join(nextRelease);
let compat = originalCompat;
const compatMatch = compat.match(/const RELEASE = '(\d{8}-r\d+)';/);
must(compatMatch, 'Seed Man canvas compatibility release marker missing');
compat = compat.replace(/const RELEASE = '\d{8}-r\d+';/, `const RELEASE = '${nextRelease}';`);

write(indexPath, index);
write(compatPath, compat);
if (publisher !== originalPublisher) write(publisherPath, publisher);

console.log(JSON.stringify({
  currentRelease,
  nextRelease,
  changed: true,
  patched: [
    ...(index !== originalIndex ? [indexPath] : []),
    ...(compat !== originalCompat ? [compatPath] : []),
    ...(publisher !== originalPublisher ? [publisherPath] : [])
  ],
  gameplayFile: 'site/public-route-patch/games/seed-man-platformer/gameplay-v2.js'
}, null, 2));
