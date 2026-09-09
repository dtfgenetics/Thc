import fs from 'node:fs';

// Canonical v20 deployment metadata reconciler. Keep this in sync with the
// Seed Man production contract so main can persist the normalized registry.
const targetPath = 'site/deployment/public-apps.json';
const document = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
const app = document.apps?.find((entry) => entry.id === 'seed-man-platformer');
if (!app) throw new Error('Seed Man deployment registry entry was not found.');

app.title = 'Seed Man: Grow. Fight. Restore.';
app.runtime = 'static-canvas2d-approved-art';
app.status = 'production-v20';
app.build = [
  'node games/seed-man-platformer/test/physics.test.mjs',
  'node games/seed-man-platformer/test/progression-systems.test.mjs',
  'node games/seed-man-platformer/test/campaign.test.mjs',
  'node games/seed-man-platformer/test/art-registry.test.mjs',
  'node games/seed-man-platformer/test/public-runtime.test.mjs',
  'node games/seed-man-platformer/test/public-campaign.test.mjs',
  'node games/seed-man-platformer/test/input-guard.test.mjs',
  'node scripts/verify-seed-man-production-v20.mjs',
  'node scripts/validate-seed-man-production-bundle.mjs'
].join(' && ');

app.machineData = {
  release: '20260908-v20',
  campaignId: 'seed-man-campaign-20-v1',
  defaultLevelId: '1-1-sprout-steps',
  levelCount: 20,
  worldCount: 5,
  bossCount: 6,
  finalBoss: 'blight-king',
  finalBossPhases: 4,
  phenotypeDurationSeconds: 30,
  phenotypeForms: ['plant','fire','electric','ice'],
  campaignRuntime: 'seed-man-campaign-v20-runtime-v1',
  campaignUi: 'seed-man-campaign-ui-v20',
  approvedArtManifest: 'seed-man-approved-art-v2',
  approvedArtSource: 'approved-showcase-2026-09-08',
  productionCharacterArt: 'seed-man-approved-atlas-renderer-v3',
  characterContract: 'green-armored-plant-hero',
  proceduralFallbackAllowed: false,
  legacyAtlasFallbackAllowed: false,
  canvasCompat: 'sprout-canvas-compat-v20',
  doubleJump: true
};

app.notes = 'Canonical Seed Man v20 release on /games/seed-man-platformer/: 20 levels across Greenhouse Valley, Forest Ruins, Desert Canyon, Frozen Peaks and Eco City; six boss encounters; four-phase Blight King finale; 30-second phenotype combat; and the approved 2026-09-08 green armored plant-hero visual system. Retired 11/15-level campaigns, Genome Hydra, Genetic Frontier, seed-man-production-v1, seed-man-locked-v1, legacy sprite ownership and procedural character fallback must not be republished.';

document.updated = '2026-09-08';
fs.writeFileSync(targetPath, `${JSON.stringify(document, null, 2)}\n`);

const written = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
const verified = written.apps.find((entry) => entry.id === 'seed-man-platformer');
if (verified.title !== 'Seed Man: Grow. Fight. Restore.') throw new Error('Canonical Seed Man v20 title was not written.');
if (verified.machineData?.levelCount !== 20) throw new Error('Expected 20 Seed Man campaign levels.');
if (verified.machineData?.worldCount !== 5) throw new Error('Expected five Seed Man worlds.');
if (verified.machineData?.bossCount !== 6) throw new Error('Expected six Seed Man bosses.');
if (verified.machineData?.finalBoss !== 'blight-king') throw new Error('Expected Blight King final boss.');
if (verified.machineData?.release !== '20260908-v20') throw new Error('Unexpected Seed Man v20 release marker.');
if (verified.machineData?.characterContract !== 'green-armored-plant-hero') throw new Error('Approved Seed Man character contract was not recorded.');
if (verified.machineData?.proceduralFallbackAllowed !== false || verified.machineData?.legacyAtlasFallbackAllowed !== false) throw new Error('Seed Man production fallbacks must remain disabled.');

console.log(JSON.stringify({ok:true,targetPath,title:verified.title,release:verified.machineData.release,levels:20,worlds:5,bosses:6,finalBoss:'blight-king',approvedArt:verified.machineData.approvedArtSource}, null, 2));
