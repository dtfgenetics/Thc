import fs from 'node:fs';

const targetPath = 'site/deployment/public-apps.json';
const document = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
const app = document.apps?.find((entry) => entry.id === 'seed-man-platformer');

if (!app) throw new Error('Seed Man deployment registry entry was not found.');

app.title = 'Seed Man: Greenhouse Gauntlet';
app.runtime = 'static-canvas2d-threejs';
app.status = 'production-verified';
app.build = [
  'node games/seed-man-platformer/test/physics.test.mjs',
  'node games/seed-man-platformer/test/progression-systems.test.mjs',
  'node games/seed-man-platformer/test/campaign.test.mjs',
  'node games/seed-man-platformer/test/public-runtime.test.mjs',
  'node games/seed-man-platformer/test/public-campaign.test.mjs',
  'node games/seed-man-platformer/test/input-guard.test.mjs'
].join(' && ');

app.machineData = {
  ...app.machineData,
  level: 'sprout-run',
  edition: 'greenhouse-gauntlet',
  release: '20260907-r17',
  levelCount: 15,
  worldCount: 5,
  bossCount: 6,
  phenotypeDurationSeconds: 30,
  threeJsRenderer: 'seed-man-three-world-v2',
  threeJsPublicApi: 'seed-man-three-public-v3',
  threeJsOptimization: 'seed-man-three-instancing-v1',
  campaignUi: 'seed-man-campaign-ui-v15',
  ui: 'seed-man-ui-v3',
  visualSystem: 'seed-man-visual-v4',
  authoredSpriteRuntime: 'seed-man-sprite-runtime-v1',
  worldWidth: 7800,
  collectibles: 24,
  powerups: 7,
  checkpointCount: 3,
  hazardZones: 15,
  doubleJump: true,
  productionCharacterArt: 'seed-man-production-v1',
  characterContract: 'seed-man-locked-v1'
};

app.notes = 'Production-verified Greenhouse Gauntlet campaign on /games/seed-man-platformer/: 15 levels across five worlds with six bosses, 30-second phenotype absorption/combat, authored Seed Man sprite runtime, Canvas2D gameplay, and the optimized Three.js five-world renderer. Level 1 keeps the internal sprout-run compatibility ID intentionally; the retired Sprout Run product title and 2,600 px eight-sprout vertical slice must never be republished.';

document.updated = '2026-09-08';
fs.writeFileSync(targetPath, `${JSON.stringify(document, null, 2)}\n`);

const written = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
const verified = written.apps.find((entry) => entry.id === 'seed-man-platformer');
if (verified.title !== 'Seed Man: Greenhouse Gauntlet') throw new Error('Canonical Seed Man title was not written.');
if (verified.machineData?.levelCount !== 15) throw new Error('Expected 15 Seed Man campaign levels.');
if (verified.machineData?.worldCount !== 5) throw new Error('Expected five Seed Man worlds.');
if (verified.machineData?.bossCount !== 6) throw new Error('Expected six Seed Man bosses.');
if (verified.machineData?.release !== '20260907-r17') throw new Error('Unexpected Seed Man production release marker.');
if (!String(verified.runtime).includes('threejs')) throw new Error('Deployment runtime must record Three.js ownership.');

console.log(JSON.stringify({
  ok: true,
  targetPath,
  title: verified.title,
  release: verified.machineData.release,
  levels: verified.machineData.levelCount,
  worlds: verified.machineData.worldCount,
  bosses: verified.machineData.bossCount,
  runtime: verified.runtime
}, null, 2));
