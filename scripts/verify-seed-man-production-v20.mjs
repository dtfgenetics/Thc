import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('site/public-route-patch/games/seed-man-platformer');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const campaign = JSON.parse(read('data/campaign.json'));
const levels = JSON.parse(read('data/levels-20-v1.json'));
const art = JSON.parse(read('data/seed-man-art-manifest-v1.json'));

const requiredFiles = [
  'index.html','app.js','canvas-compat-v1.js','campaign-v1.js','campaign-v20-runtime.js','campaign-ui-v20.js',
  'approved-art-core-v1.js','approved-art-runtime-v1.js','seed-man-production-art.js','gameplay-v2.js',
  'combat-browser-v1.js','enemy-attacks-browser-v1.js','enemy-attacks.js','world-five-v1.js','three-world-v1.js',
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

const artText = JSON.stringify(art);
for (const marker of ['green-armored-plant-hero','world.greenhouse-valley','world.forest-ruins','world.desert-canyon','world.frozen-peak','world.eco-city']) {
  if (!artText.includes(marker)) throw new Error(`Approved art manifest missing marker: ${marker}`);
}
const renderer = read('seed-man-production-art.js');
for (const marker of ['approved-showcase-2026-09-08','green-armored-plant-hero','fallbackAllowed:false']) {
  if (!renderer.includes(marker)) throw new Error(`Approved renderer missing marker: ${marker}`);
}
const runtime = read('campaign-v20-runtime.js');
if (!runtime.includes('seed-man-campaign-v20-runtime-v1')) throw new Error('Canonical v20 runtime marker is missing');
for (const stale of ['"levelCount": 15','"newLevelCount": 14','baseRuntimeLevelCount','Genome Hydra','Voltage Wasp Alpha']) {
  if (read('data/campaign.json').includes(stale)) throw new Error(`Retired campaign marker remains: ${stale}`);
}
console.log(JSON.stringify({ok:true,levels:20,worlds:5,finalBoss:'blight-king',approvedArt:true}));
