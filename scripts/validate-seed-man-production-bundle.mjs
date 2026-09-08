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
  'seed-man-sprite-runtime-v2.js','gameplay-v2.js','combat-browser-v1.js','enemy-attacks-browser-v1.js','enemy-attacks.js','world-five-v1.js',
  'input-guard-v1.js','seed-man.css','physics.mjs','three-world-v1.js',
  'data/campaign.json','data/level-01.json','data/levels-12-15.json','data/levels-20-v1.json','data/campaign-20-v1.json',
  'data/seed-man-art-manifest-v1.json','data/enemy-catalog-v1.json','data/boss-catalog-v1.json'
]) requireFile(rel);

const index = read('index.html');
const release = index.match(/name="dtf-sprout-release" content="([^"]+)"/)?.[1];
if (!/^\d{8}-r\d+$/.test(release || '')) throw new Error(`invalid-release:${release || '<missing>'}`);
for (const marker of [
  'Seed Man · Greenhouse Gauntlet','0 / 24','JUMP ×2','stomp pests from above',
  `./gameplay-v2.js?v=${release}`,`./campaign-v1.js?v=${release}`,'world-five-v1.js','three-world-v1.js'
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
for (const marker of ['seed-man-approved-atlas-renderer-v3','approved-showcase-2026-09-08','green-armored-plant-hero']) includes('seed-man-production-art.js', marker);
includes('seed-man-sprite-runtime-v2.js', 'approvedRendererAvailable');
includes('three-world-v1.js', 'SeedManThreeWorld');

const campaign = JSON.parse(read('data/campaign.json'));
if (campaign.id !== 'sprout-run-campaign') throw new Error(`campaign-id:${campaign.id}`);
if (campaign.levelCount !== 20) throw new Error(`campaign-levelCount:expected-20:got-${campaign.levelCount}`);
if (campaign.newLevelCount !== 19) throw new Error(`campaign-newLevelCount:expected-19:got-${campaign.newLevelCount}`);
if (campaign.worlds?.length !== 5) throw new Error(`campaign-worldCount:expected-5:got-${campaign.worlds?.length}`);
if (campaign.finalBoss !== 'blight-king') throw new Error(`campaign-finalBoss:expected-blight-king:got-${campaign.finalBoss}`);
if (campaign.defaultLevelId !== '1-1-sprout-steps') throw new Error(`campaign-defaultLevelId:${campaign.defaultLevelId}`);
const allLevels = campaign.worlds.flatMap((world) => world.levels || []);
if (allLevels.length !== 20) throw new Error(`campaign-flattened-levelCount:expected-20:got-${allLevels.length}`);
if (allLevels.at(-1)?.id !== '5-4-the-last-seed') throw new Error(`campaign-final-level:${allLevels.at(-1)?.id}`);
if (allLevels.at(-1)?.boss !== 'blight-king') throw new Error(`campaign-final-level-boss:${allLevels.at(-1)?.boss}`);

const worldFive = JSON.parse(read('data/levels-12-15.json'));
const ids = worldFive.levels?.map((level) => level.id) || [];
const expectedIds = ['chromosome-crossing','mutation-marsh','allele-array','genome-spire'];
if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) throw new Error(`world-five-compatibility-ids:${JSON.stringify(ids)}`);

const manifest = JSON.parse(read('data/seed-man-art-manifest-v1.json'));
if (manifest.id !== 'seed-man-approved-art-v2') throw new Error(`approved-art-manifest:${manifest.id}`);
if (manifest.policy?.authoritative !== true || manifest.policy?.proceduralFallbackAllowed !== false || manifest.policy?.legacyAtlasFallbackAllowed !== false) {
  throw new Error('approved-art-policy-mismatch');
}
if (!manifest.masterAtlas?.publicSrc?.includes('seed-man-approved-master-atlas-v1.webp')) throw new Error('approved-master-atlas-missing');

console.log(JSON.stringify({
  ok:true,
  release,
  campaignLevels:campaign.levelCount,
  campaignWorlds:campaign.worlds.length,
  finalBoss:campaign.finalBoss,
  approvedArtManifest:manifest.id,
  legacyWorldFiveIds:ids
}, null, 2));
