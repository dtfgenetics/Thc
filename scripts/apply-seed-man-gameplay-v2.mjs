import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, text); }
function must(condition, message) { if (!condition) throw new Error(message); }
function escapeRegex(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const indexPath = 'site/public-route-patch/games/seed-man-platformer/index.html';
const compatPath = 'site/public-route-patch/games/seed-man-platformer/canvas-compat-v1.js';
const publisherPath = 'scripts/publish-seed-man-route-via-wordpress.mjs';
const uiPath = 'site/public-route-patch/games/seed-man-platformer/seed-man-ui-v3.js';
const uiTestPath = 'games/seed-man-platformer/test/ui-v3-browser.test.mjs';

const originalIndex = read(indexPath);
const originalCompat = read(compatPath);
const originalPublisher = read(publisherPath);
const originalUi = read(uiPath);
const originalUiTest = read(uiTestPath);

let index = originalIndex;
let publisher = originalPublisher;
let ui = originalUi;
let uiTest = originalUiTest;

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
const canonicalLede = 'Run the full Seed Man campaign across Greenhouse District, Rootworks, Resin Works, Sky Garden and Genetic Frontier. Collect sprouts, master responsive double-jump movement, defeat phenotype carriers to absorb temporary powers, survive six boss encounters, activate checkpoints, and restore every world.';

index = index.replace(/<title>[^<]*<\/title>/, `<title>${canonicalTitle}</title>`);
index = index.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${canonicalDescription}">`);
index = index.replace(/<h1>Sprout Run<\/h1>/, '<h1>Seed Man</h1>');
index = index.replace(/aria-label="Sprout Run features"/, 'aria-label="Seed Man campaign features"');
index = index.replace(/"title": "Seed Man: Sprout Run"/, '"title": "Seed Man: Greenhouse Gauntlet"');

const ledePattern = /<p class="lede">([^<]*)<\/p>/;
const ledeMatch = index.match(ledePattern);
must(ledeMatch, 'Could not identify the Seed Man hero lede structurally');
index = index.replace(ledePattern, `<p class="lede">${canonicalLede}</p>`);

const displayAliases = `  const DISPLAY_WORLD_TITLES = Object.freeze({\n    'Greenhouse District': 'Greenhouse Valley',\n    Rootworks: 'Forest Ruins',\n    'Resin Works': 'Desert Canyon',\n    'Sky Garden': 'Frozen Peak',\n    'Genetic Frontier': 'Eco City'\n  });\n`;
ui = ui.replace(displayAliases, '');
ui = ui.replace("    { id: 'world-01', number: '01', title: 'Greenhouse Valley', levelId: 'sprout-run' },", "    { id: 'world-01', number: '01', title: 'Greenhouse District', levelId: 'sprout-run' },");
ui = ui.replace("    { id: 'world-02', number: '02', title: 'Forest Ruins', levelId: 'root-zone-rumble' },", "    { id: 'world-02', number: '02', title: 'Rootworks', levelId: 'root-zone-rumble' },");
ui = ui.replace("    { id: 'world-03', number: '03', title: 'Desert Canyon', levelId: 'kief-cavern-climb' },", "    { id: 'world-03', number: '03', title: 'Resin Works', levelId: 'kief-cavern-climb' },");
ui = ui.replace("    { id: 'world-04', number: '04', title: 'Frozen Peak', levelId: 'frostline-canopy' },", "    { id: 'world-04', number: '04', title: 'Sky Garden', levelId: 'frostline-canopy' },");
ui = ui.replace("    { id: 'world-05', number: '05', title: 'Eco City', levelId: 'chromosome-crossing' }", "    { id: 'world-05', number: '05', title: 'Genetic Frontier', levelId: 'chromosome-crossing' }");
ui = ui.replace("    return DISPLAY_WORLD_TITLES[value] || value || 'Seed Man Campaign';", "    return value || 'Seed Man Campaign';");
ui = ui.replace('Cross Greenhouse Valley, Forest Ruins, Desert Canyon and Frozen Peak on the way to Eco City.', 'Cross Greenhouse District, Rootworks, Resin Works and Sky Garden on the way to Genetic Frontier.');

const replacements = [
  ['Greenhouse Valley', 'Greenhouse District'],
  ['Forest Ruins', 'Rootworks'],
  ['Desert Canyon', 'Resin Works'],
  ['Frozen Peak', 'Sky Garden'],
  ['Eco City', 'Genetic Frontier']
];
for (const [from, to] of replacements) uiTest = uiTest.split(from).join(to);

must(index.includes(`<title>${canonicalTitle}</title>`), 'Seed Man static title is not canonical');
must(index.includes(`<h1>Seed Man</h1>`), 'Seed Man static hero heading is not canonical');
must(index.includes('Greenhouse District') && index.includes('Genetic Frontier'), 'Seed Man static campaign copy is not five-world aware');
must(!index.includes('<h1>Sprout Run</h1>'), 'Retired Sprout Run product heading remains');
must(!ui.includes('Greenhouse Valley') && !ui.includes('Forest Ruins') && !ui.includes('Desert Canyon') && !ui.includes('Frozen Peak') && !ui.includes('Eco City'), 'Seed Man UI still contains retired world aliases');
must(ui.includes("title: 'Greenhouse District'") && ui.includes("title: 'Genetic Frontier'"), 'Seed Man UI world rail is not canonical');
must(uiTest.includes("'Greenhouse District', 'Greenhouse District'") && uiTest.includes("'Genetic Frontier', 'Genetic Frontier'"), 'Seed Man browser assertions are not canonical');

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

const contentChanged = index !== originalIndex || publisher !== originalPublisher || ui !== originalUi || uiTest !== originalUiTest;
if (!contentChanged) {
  console.log(JSON.stringify({
    currentRelease,
    nextRelease: currentRelease,
    changed: false,
    reason: 'gameplay-v2, static campaign identity, and canonical world names already aligned',
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
if (ui !== originalUi) write(uiPath, ui);
if (uiTest !== originalUiTest) write(uiTestPath, uiTest);

console.log(JSON.stringify({
  currentRelease,
  nextRelease,
  changed: true,
  patched: [
    ...(index !== originalIndex ? [indexPath] : []),
    ...(compat !== originalCompat ? [compatPath] : []),
    ...(publisher !== originalPublisher ? [publisherPath] : []),
    ...(ui !== originalUi ? [uiPath] : []),
    ...(uiTest !== originalUiTest ? [uiTestPath] : [])
  ],
  gameplayFile: 'site/public-route-patch/games/seed-man-platformer/gameplay-v2.js'
}, null, 2));
