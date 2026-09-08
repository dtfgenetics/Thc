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

const canonicalTitle = 'Seed Man: Greenhouse Gauntlet | DTF Genetics';
const canonicalDescription = 'Play Seed Man: Greenhouse Gauntlet, the DTF Genetics platform adventure spanning five worlds and 15 levels with six bosses, phenotype combat, authored character animation, checkpoints, and responsive desktop and touch controls.';
const canonicalLede = 'Run the full Seed Man campaign across Greenhouse Valley, Forest Ruins, Desert Canyon, Frozen Peak and Eco City. Collect sprouts, master responsive double-jump movement, defeat phenotype carriers to absorb temporary powers, survive six boss encounters, activate checkpoints, and restore every world.';

index = index.replace(/<title>[^<]*<\/title>/, `<title>${canonicalTitle}</title>`);
index = index.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${canonicalDescription}">`);
index = index.replace(/<h1>Sprout Run<\/h1>/, '<h1>Seed Man</h1>');
index = index.replace(/aria-label="Sprout Run features"/, 'aria-label="Seed Man campaign features"');
index = index.replace(/"title": "Seed Man: Sprout Run"/, '"title": "Seed Man: Greenhouse Gauntlet"');

const ledePattern = /<p class="lede">([^<]*)<\/p>/;
const ledeMatch = index.match(ledePattern);
must(ledeMatch, 'Could not identify the Seed Man hero lede structurally');
index = index.replace(ledePattern, `<p class="lede">${canonicalLede}</p>`);

must(index.includes(`<title>${canonicalTitle}</title>`), 'Seed Man static title is not canonical');
must(index.includes(`<h1>Seed Man</h1>`), 'Seed Man static hero heading is not canonical');
must(index.includes('Greenhouse Valley') && index.includes('Eco City'), 'Seed Man static campaign copy is not five-world aware');
must(!index.includes('<h1>Sprout Run</h1>'), 'Retired Sprout Run product heading remains');

const gameplayCopy = '<strong>Gameplay:</strong> stomp pests from above, use BOOST pads for high routes, and time moving greenhouse platforms. ';
const powerupCopy = '<strong>Power-ups:</strong> gold = speed, green = high jump, purple = sprout magnet, blue = hazard shield.';
const repeatedGameplay = new RegExp(`(?:${escapeRegex(gameplayCopy)})+${escapeRegex(powerupCopy)}`, 'g');
index = index.replace(repeatedGameplay, `${gameplayCopy}${powerupCopy}`);

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
    reason: 'gameplay-v2 and static campaign identity already canonical',
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
