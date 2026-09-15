import fs from 'node:fs';

const PUBLIC_APPS = 'site/deployment/public-apps.json';
const GAME_HUB = 'site/public-route-patch/games/index.html';
const PUBLIC_NAV = 'data/public-navigation.json';
const GAME_SOURCE_MAP = 'data/game-source-map.json';
const HOME_PAGE = 'site/wordpress/pages/home.html';

const TITLE = 'Seed Man: Grow. Fight. Restore.';
const ROUTE = '/games/seed-man-platformer/';
const RELEASE = '20260913-v20-runtime-repair-v2';
const HUB_DESCRIPTION = 'Run the 20-level platform adventure across Greenhouse Valley, Forest Ruins, Desert Canyon, Frozen Peaks and Eco City. Use repaired traversal mechanics, absorb 30-second Fire, Electric and Ice phenotype powers, defeat six bosses, and face Blight King in The Last Seed.';

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function replaceRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Seed Man v20 reconciliation could not locate ${label}.`);
  return source.replace(pattern, replacement);
}

const document = readJson(PUBLIC_APPS);
const app = document.apps?.find((entry) => entry.id === 'seed-man-platformer');
if (!app) throw new Error('Seed Man deployment registry entry was not found.');

app.title = TITLE;
app.runtime = 'static-canvas2d-authored-world-transition';
app.status = 'production-v20-repair';
app.build = [
  'node games/seed-man-platformer/test/physics.test.mjs',
  'node games/seed-man-platformer/test/progression-systems.test.mjs',
  'node games/seed-man-platformer/test/campaign.test.mjs',
  'node games/seed-man-platformer/test/art-registry.test.mjs',
  'node games/seed-man-platformer/test/public-runtime.test.mjs',
  'node games/seed-man-platformer/test/public-campaign.test.mjs',
  'node games/seed-man-platformer/test/input-guard.test.mjs',
  'node scripts/verify-seed-man-production-v20.mjs',
  'node scripts/validate-seed-man-production-bundle.mjs',
  'node scripts/prepare-seed-man-release-version.mjs'
].join(' && ');

app.machineData = {
  release: RELEASE,
  campaignId: 'seed-man-campaign-20-v1',
  defaultLevelId: '1-1-sprout-steps',
  levelCount: 20,
  worldCount: 5,
  bossCount: 6,
  finalBoss: 'blight-king',
  finalBossPhases: 4,
  phenotypeDurationSeconds: 30,
  phenotypeForms: ['plant','fire','electric','ice'],
  campaignRuntime: 'seed-man-campaign-v20-runtime-v3',
  campaignUi: 'seed-man-campaign-ui-v20',
  artManifest: 'seed-man-art-manifest-v3',
  artSourceOfTruth: 'classic-seed-man-oval-v1',
  productionCharacterArt: 'seed-man-transition-atlas-renderer-v5',
  characterTarget: 'classic-seed-man-oval-v1',
  currentCharacterAsset: 'green-armored-plant-hero',
  currentCharacterStatus: 'temporary-legacy-replacement-pending',
  worldPresentation: 'seed-man-authored-flat-background-v1',
  worldRendererTarget: 'seed-man-three-world-v2',
  finalWorldLayerCount: 7,
  proceduralFallbackAllowed: false,
  unregisteredLegacyAtlasFallbackAllowed: false,
  canvasCompat: 'seed-man-runtime-health-v21',
  runtimeMechanics: 'seed-man-runtime-mechanics-v1',
  releaseTruth: 'seed-man-release-truth-v1',
  doubleJump: true,
  stomp: true,
  plantPierce: true,
  electricChainTargets: 3,
  iceFreezeSeconds: 1.8
};
app.notes = 'Seed Man v20 repaired release candidate for /games/seed-man-platformer/: 20 authored levels, five local authored world background masters, repaired traversal mechanics, six boss encounters, four-phase Blight King finale, corrected phenotype combat, and truthful transition toward classic-seed-man-oval-v1. The current green-armored atlas remains temporary and must not be described as the final approved character. Seven-layer world kits remain the explicit final visual target.';
document.updated = '2026-09-13';
writeJson(PUBLIC_APPS, document);

let hub = fs.readFileSync(GAME_HUB, 'utf8');
const hubCard = `<article class="card feature-card seed-man-feature"><div class="feature-art seed-man" role="img" aria-label="Seed Man v20 campaign preview"><strong>SEED<br>MAN</strong></div><div class="feature-copy"><span class="status">Play now</span><h3>${TITLE}</h3><p>${HUB_DESCRIPTION}</p><div class="pill-row"><span class="pill">Platform adventure</span><span class="pill">20 levels</span><span class="pill">5 worlds</span><span class="pill">Phenotype powers</span><span class="pill">6 bosses</span></div><a class="card-link" href="${ROUTE}">Play Seed Man →</a></div></article>`;
const hubPattern = /<article class="card feature-card seed-man-feature">[\s\S]*?<a class="card-link" href="\/games\/seed-man-platformer\/">Play Seed Man →<\/a><\/div><\/article>/;
hub = replaceRequired(hub, hubPattern, hubCard, 'Game Hub Seed Man feature card');
fs.writeFileSync(GAME_HUB, hub);

const navigation = readJson(PUBLIC_NAV);
const navEntry = navigation.games?.find((entry) => entry.id === 'seed-man-platformer');
if (!navEntry) throw new Error('Seed Man public-navigation entry was not found.');
navEntry.title = TITLE;
navEntry.route = ROUTE;
navEntry.status = 'play-now';
navEntry.public = true;
writeJson(PUBLIC_NAV, navigation);

const sourceMap = readJson(GAME_SOURCE_MAP);
const sourceEntry = sourceMap.games?.find((entry) => entry.id === 'seed-man-platformer');
if (!sourceEntry) throw new Error('Seed Man game-source-map entry was not found.');
sourceEntry.title = TITLE;
sourceEntry.route = ROUTE;
if (sourceEntry.canonical && typeof sourceEntry.canonical === 'object') {
  sourceEntry.canonical.campaign = 'games/seed-man-platformer/data/campaign.json';
  sourceEntry.canonical.levelCatalog = 'games/seed-man-platformer/data/levels-20-v1.json';
  sourceEntry.canonical.artManifest = 'games/seed-man-platformer/data/seed-man-art-manifest-v1.json';
}
writeJson(GAME_SOURCE_MAP, sourceMap);

let home = fs.readFileSync(HOME_PAGE, 'utf8');
home = home.replace(/<a href="\/games\/seed-man-platformer\/">\s*<strong>[^<]*<\/strong><\/a>\s*—\s*[^<\n]*/g,
  `<a href="${ROUTE}"><strong>${TITLE}</strong></a> — 20-level five-world platform adventure with phenotype combat and six bosses.`);
fs.writeFileSync(HOME_PAGE, home);

const written = readJson(PUBLIC_APPS);
const verified = written.apps.find((entry) => entry.id === 'seed-man-platformer');
if (verified.title !== TITLE) throw new Error('Canonical Seed Man v20 title was not written.');
if (verified.machineData?.levelCount !== 20) throw new Error('Expected 20 Seed Man campaign levels.');
if (verified.machineData?.worldCount !== 5) throw new Error('Expected five Seed Man worlds.');
if (verified.machineData?.bossCount !== 6) throw new Error('Expected six Seed Man bosses.');
if (verified.machineData?.finalBoss !== 'blight-king') throw new Error('Expected Blight King final boss.');
if (verified.machineData?.release !== RELEASE) throw new Error('Unexpected Seed Man repaired release marker.');
if (verified.machineData?.campaignRuntime !== 'seed-man-campaign-v20-runtime-v3') throw new Error('Unexpected Seed Man campaign runtime marker.');
if (verified.machineData?.characterTarget !== 'classic-seed-man-oval-v1') throw new Error('Classic Seed Man target was not recorded.');
if (verified.machineData?.currentCharacterStatus !== 'temporary-legacy-replacement-pending') throw new Error('Temporary character transition status was not recorded.');
if (verified.machineData?.worldPresentation !== 'seed-man-authored-flat-background-v1' || verified.machineData?.worldRendererTarget !== 'seed-man-three-world-v2') throw new Error('World transition metadata was not recorded.');
if (verified.machineData?.proceduralFallbackAllowed !== false || verified.machineData?.unregisteredLegacyAtlasFallbackAllowed !== false) throw new Error('Seed Man production fallbacks must remain disabled.');

const verifiedHub = fs.readFileSync(GAME_HUB, 'utf8');
for (const retired of ['Seed Man: Sprout Run', 'Seed Man: Greenhouse Gauntlet', '15 levels']) {
  if (verifiedHub.includes(retired)) throw new Error(`Game Hub still exposes retired Seed Man copy: ${retired}`);
}
for (const marker of [TITLE, '20 levels', '5 worlds', '6 bosses']) {
  if (!verifiedHub.includes(marker)) throw new Error(`Game Hub missing Seed Man v20 marker: ${marker}`);
}
if (navEntry.title !== TITLE || sourceEntry.title !== TITLE) throw new Error('Seed Man public metadata identity is not v20.');

console.log(JSON.stringify({
  ok: true,
  targets: [PUBLIC_APPS, GAME_HUB, PUBLIC_NAV, GAME_SOURCE_MAP, HOME_PAGE],
  title: verified.title,
  release: verified.machineData.release,
  campaignRuntime: verified.machineData.campaignRuntime,
  levels: 20,
  worlds: 5,
  bosses: 6,
  finalBoss: 'blight-king',
  characterTarget: verified.machineData.characterTarget,
  currentCharacterStatus: verified.machineData.currentCharacterStatus,
  worldPresentation: verified.machineData.worldPresentation
}, null, 2));
