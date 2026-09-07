import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'site/public-route-patch/games/seed-man-platformer');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const requireFile = (rel) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p) || fs.statSync(p).size === 0) throw new Error(`missing-or-empty:${rel}`);
};
const includes = (rel, marker) => {
  if (!read(rel).includes(marker)) throw new Error(`missing-marker:${rel}:${marker}`);
};
const excludes = (rel, marker) => {
  if (read(rel).includes(marker)) throw new Error(`retired-marker:${rel}:${marker}`);
};

for (const rel of [
  '.htaccess','index.html','app.js','canvas-compat-v1.js','campaign-v1.js','seed-man-production-art.js',
  'gameplay-v2.js','combat-browser-v1.js','enemy-attacks-browser-v1.js','enemy-attacks.js','world-five-v1.js',
  'input-guard-v1.js','seed-man.css','physics.mjs','data/campaign.json','data/level-01.json','data/levels-12-15.json'
]) requireFile(rel);

const index = read('index.html');
const release = index.match(/name="dtf-sprout-release" content="([^"]+)"/)?.[1];
if (!/^\d{8}-r\d+$/.test(release || '')) throw new Error(`invalid-release:${release || '<missing>'}`);
for (const marker of [
  'Seed Man · Greenhouse Gauntlet','0 / 24','JUMP ×2','stomp pests from above',
  `./gameplay-v2.js?v=${release}`,`./campaign-v1.js?v=${release}`,'world-five-v1.js'
]) includes('index.html', marker);
for (const marker of ['Original browser vertical slice','0 / 8']) excludes('index.html', marker);

for (const marker of ['sprout-run-gameplay-v2','movingPlatformDefs','pestDefs','bouncePads']) includes('gameplay-v2.js', marker);
for (const marker of [
  'seed-man-combat-browser-v1','seed-man-world-five-combat-v1','seed-man-phenotype-absorb-v1',
  'seed-man-phenotype-expansion-v1','terpene-tempest','hydro-surge','gravity-haze','PHENO ABSORBED'
]) includes('combat-browser-v1.js', marker);
for (const marker of ['seed-man-world-five-state-sync-v1','Genome Hydra','Voltage Wasp Alpha']) includes('world-five-v1.js', marker);
includes('canvas-compat-v1.js', 'combatBrowserAutoLoad: true');
for (const marker of [
  'sprout-campaign-v3','seed-man-campaign-experience-v3','seed-man-animation-v2','The Phantom Pump','Mite Queen',
  'Mildew Wraith','Pollen Warden','seed-man-level-select','boss-stomp','landing-squash','finish-celebration'
]) includes('campaign-v1.js', marker);

const campaign = JSON.parse(read('data/campaign.json'));
if (campaign.id !== 'sprout-run-campaign') throw new Error(`campaign-id:${campaign.id}`);
if (campaign.levelCount !== 15) throw new Error(`campaign-levelCount:expected-15:got-${campaign.levelCount}`);
if (campaign.newLevelCount !== 14) throw new Error(`campaign-newLevelCount:expected-14:got-${campaign.newLevelCount}`);
if (campaign.baseRuntimeCompatibility?.levelCount !== 11) {
  throw new Error(`campaign-baseRuntimeCompatibility.levelCount:expected-11:got-${campaign.baseRuntimeCompatibility?.levelCount}`);
}
if (campaign.baseRuntimeCompatibility?.newLevelCount !== 10) {
  throw new Error(`campaign-baseRuntimeCompatibility.newLevelCount:expected-10:got-${campaign.baseRuntimeCompatibility?.newLevelCount}`);
}
const worldFive = JSON.parse(read('data/levels-12-15.json'));
const ids = worldFive.levels?.map((level) => level.id) || [];
const expectedIds = ['chromosome-crossing','mutation-marsh','allele-array','genome-spire'];
if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) throw new Error(`world-five-ids:${JSON.stringify(ids)}`);

console.log(JSON.stringify({
  ok:true,
  release,
  campaignLevels:campaign.levelCount,
  baseRuntimeCompatibility:campaign.baseRuntimeCompatibility,
  worldFiveIds:ids
}, null, 2));
