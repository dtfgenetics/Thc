import fs from 'node:fs';

const PUBLIC_APPS = 'site/deployment/public-apps.json';
const GAME_JSON = 'games/seed-man-platformer/game.json';
const PUBLIC_INDEX = 'site/public-route-patch/games/seed-man-platformer/index.html';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

const game = readJson(GAME_JSON);
const index = fs.readFileSync(PUBLIC_INDEX, 'utf8');
const registry = readJson(PUBLIC_APPS);
const app = registry.apps?.find((entry) => entry.id === 'seed-man-platformer');
if (!app) throw new Error('Seed Man deployment registry entry was not found.');

const route = game.route || app.route || '/games/seed-man-platformer/';
const pageTitle = index.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
const title = game.title || pageTitle || app.title || 'Seed Man';
const release = index.match(/data-seed-man-release=["']([^"']+)["']/i)?.[1] || null;

app.title = title;
app.route = route;
app.repository = 'dtfgenetics/Thc';
app.sourcePath = 'site/public-route-patch/games/seed-man-platformer';
app.canonicalDataPath = 'games/seed-man-platformer';
app.runtime = 'browser-game';
app.status = 'active-development';
app.build = 'node scripts/validate-seed-man-production-bundle.mjs';
app.machineData = {
  ...(app.machineData && typeof app.machineData === 'object' ? app.machineData : {}),
  developmentState: 'editable',
  release,
  artManifest: game.artManifest || game.implementation?.artManifest || 'games/seed-man-platformer/data/seed-man-art-manifest-v1.json',
  visualRuntime: game.implementation?.visualRuntime || null,
  input: game.input || [],
};

for (const key of [
  'approvedArtManifest',
  'approvedArtSource',
  'productionCharacterArt',
  'characterContract',
  'proceduralFallbackAllowed',
  'legacyAtlasFallbackAllowed',
  'campaignRuntime',
  'campaignUi',
  'levelCount',
  'worldCount',
  'bossCount',
  'finalBoss',
  'finalBossPhases',
]) delete app.machineData[key];

app.notes = 'Seed Man is in active redesign and implementation work. Runtime, art, architecture, campaign structure, controls, and deployment internals may change while development remains open.';
registry.updated = new Date().toISOString().slice(0, 10);
writeJson(PUBLIC_APPS, registry);

console.log(JSON.stringify({
  ok: true,
  game: app.id,
  route: app.route,
  status: app.status,
  developmentState: app.machineData.developmentState,
  release: app.machineData.release,
}, null, 2));
