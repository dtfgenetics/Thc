import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('site/public-route-patch/games/seed-man-platformer');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const campaign = JSON.parse(read('data/campaign.json'));
const level01 = JSON.parse(read('data/level-01.json'));
const levels = JSON.parse(read('data/levels-20-v1.json'));
const art = JSON.parse(read('data/seed-man-art-manifest-v1.json'));

const requiredFiles = [
  'index.html','app.js','canvas-compat-v1.js','player-state-v20.js','campaign-v20-runtime.js','campaign-ui-v20.js',
  'approved-art-core-v1.js','approved-art-runtime-v1.js','seed-man-production-art.js',
  'v20-enemy-runtime.js','combat-browser-v2.js','enemy-attacks-browser-v2.js','enemy-attacks.js',
  'input-guard-v1.js','seed-man.css',
  'assets/approved/seed-man-approved-master-atlas-v1.webp','assets/approved/seed-man-character-atlas-v2.webp','assets/approved/seed-man-enemy-boss-atlas-v1.webp','assets/approved/seed-man-platform-atlas-v1.webp',
  'data/campaign.json','data/level-01.json','data/levels-20-v1.json','data/seed-man-art-manifest-v1.json','data/enemy-catalog-v1.json','data/boss-catalog-v1.json'
];
for (const rel of requiredFiles) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p) || fs.statSync(p).size === 0) throw new Error(`Missing production file: ${rel}`);
}

const retiredArtifacts = [
  'campaign-v1.js','gameplay-v2.js','physics.mjs','campaign-combat-v20.js','campaign-progress-v20.js','campaign-runtime-v20.js',
  'campaign-ui-v15.js','world-five-v1.js','combat-browser-v1.js','enemy-attacks-browser-v1.js','seed-man-ui-v3.js','data/levels-12-15.json'
];
for (const rel of retiredArtifacts) if (fs.existsSync(path.join(root, rel))) throw new Error(`Retired production artifact still exists: ${rel}`);

if (campaign.levelCount !== 20) throw new Error(`Expected 20 campaign levels, got ${campaign.levelCount}`);
if (campaign.newLevelCount !== 19) throw new Error(`Expected 19 new levels, got ${campaign.newLevelCount}`);
if (campaign.finalBoss !== 'blight-king') throw new Error('Final boss contract must be blight-king');
if (!Array.isArray(campaign.worlds) || campaign.worlds.length !== 5) throw new Error('Campaign must contain five worlds');
if (!String(level01.name || '').startsWith('Seed Man:')) throw new Error('Level 1 compatibility fixture must use current Seed Man identity');
if (!Array.isArray(level01.powerups) || level01.powerups.length !== 0) throw new Error('Level 1 compatibility fixture still contains retired prototype powerups');
if (!Array.isArray(levels.levels) || levels.levels.length !== 20) throw new Error('Level catalog must contain 20 levels');
const orders = levels.levels.map((l) => l.order).sort((a,b)=>a-b);
for (let i=0;i<20;i+=1) if (orders[i] !== i+1) throw new Error(`Missing level order ${i+1}`);
const finale = levels.levels.find((l) => l.order === 20);
if (!finale || finale.boss !== 'blight-king' || !finale.mechanics?.includes('final-gauntlet')) throw new Error('Level 20 finale contract is incomplete');

const campaignIds = new Set(campaign.worlds.flatMap((w)=>w.levels.map((l)=>l.id)));
for (const level of levels.levels) if (!campaignIds.has(level.id)) throw new Error(`Level missing from campaign: ${level.id}`);

if (art.id !== 'seed-man-approved-art-v2') throw new Error(`Expected approved-art manifest v2, got ${art.id || 'missing'}`);
if (art.sourceOfTruth !== 'approved-showcase-2026-09-08') throw new Error('Approved art source-of-truth marker is missing');
if (art.policy?.authoritative !== true) throw new Error('Approved art manifest must be authoritative');
if (art.policy?.proceduralFallbackAllowed !== false || art.policy?.legacyAtlasFallbackAllowed !== false) throw new Error('Approved art fallbacks must stay disabled');
if (art.policy?.characterReference !== 'green-armored-plant-hero') throw new Error('Approved Seed Man character reference is missing');
const expectedWorlds = ['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city'];
for (const world of expectedWorlds) if (!art.policy?.worlds?.includes(world)) throw new Error(`Approved art manifest missing world: ${world}`);
for (const key of ['cover.main','character.seedman.atlas','enemy.atlas','boss.atlas','platform.atlas','world.atlas','ui.vfx.cover']) {
  if (!art.assets?.[key]) throw new Error(`Approved art manifest missing asset key: ${key}`);
}
for (const region of ['cover.main','character.seedman.atlas','enemy-boss.atlas','world.atlas','platform.atlas','ui-vfx.atlas']) {
  if (!art.masterAtlas?.regions?.[region]) throw new Error(`Approved master atlas missing region: ${region}`);
}
const masterAtlasPath=path.join(root,'assets/approved/seed-man-approved-master-atlas-v1.webp');
if(fs.statSync(masterAtlasPath).size<1000)throw new Error('Approved master atlas is unexpectedly small');

const renderer = read('seed-man-production-art.js');
for (const marker of ['approved-showcase-2026-09-08','green-armored-plant-hero','fallbackAllowed:false']) {
  if (!renderer.includes(marker)) throw new Error(`Approved renderer missing marker: ${marker}`);
}
const approvedCore=read('approved-art-core-v1.js');
for(const marker of ['seed-man-approved-art-core-v3','seed-man-approved-master-atlas-v1.webp','world.greenhouse-valley.background','world.forest-ruins.background','world.desert-canyon.background','world.frozen-peaks.background','world.eco-city.background'])if(!approvedCore.includes(marker))throw new Error(`Approved world-art core missing marker: ${marker}`);
const approvedRuntime=read('approved-art-runtime-v1.js');
if(!approvedRuntime.includes('seed-man-approved-art-runtime-v2'))throw new Error('Approved character runtime v2 marker is missing');
for(const retired of ['solar-flare','static-haze','frost-resin','shield-bounce'])if(approvedRuntime.includes(retired))throw new Error(`Retired approved-art runtime token remains: ${retired}`);

const runtime = read('campaign-v20-runtime.js');
if (!runtime.includes('seed-man-campaign-v20-runtime-v3')) throw new Error('Canonical v20 runtime v3 marker is missing');
if (!runtime.includes('approvedWorldBackgrounds:true')) throw new Error('Canonical runtime does not advertise approved world backgrounds');
for (const form of ["'plant'","'fire'","'electric'","'ice'"]) if (!runtime.includes(form)) throw new Error(`Canonical phenotype form missing from campaign runtime: ${form}`);
for (const retiredPower of ["'speed'","'shield'","'magnet'","'jump'"]) if (runtime.includes(retiredPower)) throw new Error(`Retired prototype power remains in campaign runtime: ${retiredPower}`);

const enemyRuntime = read('v20-enemy-runtime.js');
if (!enemyRuntime.includes('seed-man-v20-enemy-runtime-v2')) throw new Error('Canonical v20 enemy runtime marker is missing');
for (const enemyType of ['sproutling','root-crawler','toxic-spore','drone-bot','thorn-beetle','sky-wasp','spike-plant','sludge-monster','bone-weed','shadow-root']) {
  if (!enemyRuntime.includes(`'${enemyType}'`)) throw new Error(`Canonical enemy runtime missing enemy type: ${enemyType}`);
}
if (!enemyRuntime.includes('PHENOTYPE_DURATION_MS = 30000')) throw new Error('Phenotype carrier duration must remain exactly 30000ms');

const combat = read('combat-browser-v2.js');
if (!combat.includes('seed-man-combat-browser-v2')) throw new Error('Canonical combat-browser-v2 marker is missing');
for (const retiredPhenotype of ['solar-flare','static-haze','frost-resin','hydro-surge','terpene-tempest','vine-lash','mycelium-mind','rootbreaker','trichome-crystal','gravity-haze']) {
  if (combat.includes(retiredPhenotype)) throw new Error(`Retired phenotype remains in canonical combat runtime: ${retiredPhenotype}`);
}
const attacks = read('enemy-attacks-browser-v2.js');
if (!attacks.includes('seed-man-enemy-attacks-browser-v2')) throw new Error('Canonical enemy-attacks-browser-v2 marker is missing');
const playerState=read('player-state-v20.js');
if(!playerState.includes('seed-man-player-state-v20'))throw new Error('Canonical player-state-v20 marker is missing');

const index = read('index.html');
for (const stale of ['campaign-v1.js','gameplay-v2.js','campaign-ui-v15.js','world-five-v1.js','levels-12-15.json','combat-browser-v1.js','enemy-attacks-browser-v1.js','TOTAL_LEVELS = 15','levelCount: 15']) {
  if (index.includes(stale)) throw new Error(`Legacy Seed Man reference remains in public index: ${stale}`);
}
for (const required of ['v20-enemy-runtime.js','combat-browser-v2.js','enemy-attacks-browser-v2.js']) {
  if (!index.includes(required)) throw new Error(`Public index missing canonical combat runtime: ${required}`);
}
for (const stale of ['"levelCount": 15','"newLevelCount": 14','baseRuntimeLevelCount','Genome Hydra','Voltage Wasp Alpha']) {
  if (read('data/campaign.json').includes(stale)) throw new Error(`Retired campaign marker remains: ${stale}`);
}
console.log(JSON.stringify({ok:true,levels:20,worlds:5,finalBoss:'blight-king',approvedArt:true,approvedWorldArt:true,approvedArtManifest:art.id,playerState:'v20',campaignRuntime:'v3',combatRuntime:'v2',retiredArtifactsRemoved:retiredArtifacts.length}));
