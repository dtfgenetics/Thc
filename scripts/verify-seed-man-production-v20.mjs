import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('site/public-route-patch/games/seed-man-platformer');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const campaign = JSON.parse(read('data/campaign.json'));
const levels = JSON.parse(read('data/levels-20-v1.json'));
const art = JSON.parse(read('data/seed-man-art-manifest-v1.json'));

const requiredFiles = [
  'index.html','app.js','canvas-compat-v1.js','campaign-v20-runtime.js','v20-campaign-guard.js','campaign-ui-v20.js',
  'approved-art-core-v1.js','approved-art-runtime-v1.js','seed-man-production-art.js',
  'v20-enemy-runtime.js','combat-browser-v2.js','enemy-attacks-browser-v2.js','enemy-attacks.js',
  'input-guard-v1.js','seed-man.css','physics.mjs','data/campaign.json','data/levels-20-v1.json',
  'data/seed-man-art-manifest-v1.json','data/enemy-catalog-v1.json','data/boss-catalog-v1.json'
];
for (const rel of requiredFiles) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p) || fs.statSync(p).size === 0) throw new Error(`Missing production file: ${rel}`);
}

if (campaign.levelCount !== 20) throw new Error(`Expected 20 campaign levels, got ${campaign.levelCount}`);
if (campaign.newLevelCount !== 19) throw new Error(`Expected 19 new levels, got ${campaign.newLevelCount}`);
if (campaign.finalBoss !== 'blight-king') throw new Error('Final boss contract must be blight-king');
if (!Array.isArray(campaign.worlds) || campaign.worlds.length !== 5) throw new Error('Campaign must contain five worlds');
if (!Array.isArray(levels.levels) || levels.levels.length !== 20) throw new Error('Level catalog must contain 20 levels');
const orders = levels.levels.map((l) => l.order).sort((a,b)=>a-b);
for (let i=0;i<20;i+=1) if (orders[i] !== i+1) throw new Error(`Missing level order ${i+1}`);
const finale = levels.levels.find((l) => l.order === 20);
if (!finale || finale.boss !== 'blight-king' || !finale.mechanics?.includes('final-gauntlet')) throw new Error('Level 20 finale contract is incomplete');

const campaignIds = new Set(campaign.worlds.flatMap((w)=>w.levels.map((l)=>l.id)));
for (const level of levels.levels) if (!campaignIds.has(level.id)) throw new Error(`Level missing from campaign: ${level.id}`);

const enemyCatalog = JSON.parse(read('data/enemy-catalog-v1.json'));
for (const level of levels.levels) {
  for (const enemy of level.enemyPool || []) {
    if (!enemyCatalog.common?.[enemy]) throw new Error(`Unknown enemyPool entry ${enemy} in ${level.id}`);
  }
}
for (const carrier of ['fire-carrier','electric-carrier','ice-carrier']) {
  if (!enemyCatalog.phenotypeCarriers?.[carrier] || enemyCatalog.phenotypeCarriers[carrier].dropDurationMs !== 30000) throw new Error(`Invalid phenotype carrier contract: ${carrier}`);
}

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

const renderer = read('seed-man-production-art.js');
for (const marker of ['approved-showcase-2026-09-08','green-armored-plant-hero','fallbackAllowed:false']) {
  if (!renderer.includes(marker)) throw new Error(`Approved renderer missing marker: ${marker}`);
}
const runtime = read('campaign-v20-runtime.js');
if (!runtime.includes('seed-man-campaign-v20-runtime-v1')) throw new Error('Canonical v20 runtime marker is missing');
const enemyRuntime = read('v20-enemy-runtime.js');
if (!enemyRuntime.includes('seed-man-v20-enemy-runtime-v1') || !enemyRuntime.includes("['fire','electric','ice']")) throw new Error('Canonical v20 enemy runtime contract is missing');
const combat = read('combat-browser-v2.js');
if (!combat.includes('seed-man-combat-browser-v2') || !combat.includes('PHENOTYPE_DURATION = 30')) throw new Error('Canonical v20 combat runtime contract is missing');
const attacks = read('enemy-attacks-browser-v2.js');
if (!attacks.includes('seed-man-enemy-attacks-browser-v2')) throw new Error('Canonical hostile attack runtime contract is missing');
const guard = read('v20-campaign-guard.js');
for (const retired of ['speed','shield','magnet','jump']) if (!guard.includes(`'${retired}'`)) throw new Error(`Campaign guard missing retired powerup: ${retired}`);

const index = read('index.html');
for (const stale of ['campaign-ui-v15.js','world-five-v1.js','levels-12-15.json','TOTAL_LEVELS = 15','levelCount: 15','combat-browser-v1.js','enemy-attacks-browser-v1.js','"id":"sprout-run"','bootstrap-speed','bootstrap-shield','bootstrap-magnet','bootstrap-jump']) {
  if (index.includes(stale)) throw new Error(`Legacy Seed Man reference remains in public index: ${stale}`);
}
for (const required of ['campaign-v20-runtime.js','v20-campaign-guard.js','campaign-ui-v20.js','v20-enemy-runtime.js','combat-browser-v2.js','enemy-attacks-browser-v2.js']) {
  if (!index.includes(required)) throw new Error(`Public index missing canonical v20 script: ${required}`);
}
for (const stale of ['"levelCount": 15','"newLevelCount": 14','baseRuntimeLevelCount','Genome Hydra','Voltage Wasp Alpha']) {
  if (read('data/campaign.json').includes(stale)) throw new Error(`Retired campaign marker remains: ${stale}`);
}
console.log(JSON.stringify({ok:true,levels:20,worlds:5,finalBoss:'blight-king',approvedArt:true,approvedArtManifest:art.id,combat:'seed-man-combat-browser-v2',enemyRuntime:'seed-man-v20-enemy-runtime-v1'}));
