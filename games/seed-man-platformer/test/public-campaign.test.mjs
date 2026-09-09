import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('../../../site/public-route-patch/games/seed-man-platformer/', import.meta.url);

const [canonicalCampaignText, publicCampaignText, canonicalLevels20Text, publicLevels20Text, html, v20Runtime, v20Ui, approvedCore] = await Promise.all([
  readFile(new URL('data/campaign.json', root), 'utf8'),
  readFile(new URL('data/campaign.json', publicRoot), 'utf8'),
  readFile(new URL('data/levels-20-v1.json', root), 'utf8'),
  readFile(new URL('data/levels-20-v1.json', publicRoot), 'utf8'),
  readFile(new URL('index.html', publicRoot), 'utf8'),
  readFile(new URL('campaign-v20-runtime.js', publicRoot), 'utf8'),
  readFile(new URL('campaign-ui-v20.js', publicRoot), 'utf8'),
  readFile(new URL('approved-art-core-v1.js', publicRoot), 'utf8')
]);

const campaign = JSON.parse(canonicalCampaignText);
const publicCampaign = JSON.parse(publicCampaignText);
const levels20 = JSON.parse(canonicalLevels20Text);
const publicLevels20 = JSON.parse(publicLevels20Text);

assert.deepStrictEqual(publicCampaign, campaign, 'public campaign manifest must match canonical v20 campaign data');
assert.deepStrictEqual(publicLevels20, levels20, 'public 20-level catalog must match canonical definitions');
assert.equal(campaign.levelCount, 20);
assert.equal(campaign.newLevelCount, 19);
assert.equal(campaign.worlds.length, 5);
assert.equal(campaign.worlds.flatMap((world) => world.levels).length, 20);
assert.equal(campaign.defaultLevelId, '1-1-sprout-steps');
assert.equal(campaign.finalBoss, 'blight-king');
assert.equal(levels20.levels.length, 20);
assert.equal(levels20.levels.at(-1).id, '5-4-the-last-seed');
assert.equal(levels20.levels.at(-1).boss, 'blight-king');

for (const retired of [
  'data/levels-12-15.json',
  'campaign-v1.js',
  'gameplay-v2.js',
  'physics.mjs',
  'campaign-combat-v20.js',
  'campaign-progress-v20.js',
  'campaign-runtime-v20.js',
  'campaign-ui-v15.js',
  'world-five-v1.js',
  'combat-browser-v1.js',
  'enemy-attacks-browser-v1.js',
  'seed-man-ui-v3.js'
]) {
  await assert.rejects(access(new URL(retired, publicRoot)), { code: 'ENOENT' }, `retired public artifact must stay removed: ${retired}`);
}

await access(new URL('player-state-v20.js', publicRoot));
await access(new URL('assets/approved/seed-man-approved-master-atlas-v1.webp', publicRoot));
assert.match(html, /campaign-v20-runtime\.js\?v=[^"']+/, 'public page must load canonical v20 campaign runtime');
assert.match(html, /campaign-ui-v20\.js\?v=[^"']+/, 'public page must load canonical v20 campaign UI');
assert.match(html, /v20-enemy-runtime\.js\?v=[^"']+/, 'public page must load canonical v20 enemy runtime');
assert.match(html, /combat-browser-v2\.js\?v=[^"']+/, 'public page must load canonical v20 combat runtime');
assert.match(html, /enemy-attacks-browser-v2\.js\?v=[^"']+/, 'public page must load canonical v20 enemy attack runtime');
assert.doesNotMatch(html, /campaign-v1\.js|gameplay-v2\.js|campaign-ui-v15\.js|world-five-v1\.js|combat-browser-v1\.js|enemy-attacks-browser-v1\.js|seed-man-ui-v3\.js/, 'public page must not load retired compatibility runtimes');
assert.match(v20Runtime, /seed-man-campaign-v20-runtime-v3/, 'v20 approved-world runtime v3 marker missing');
assert.match(v20Runtime, /approvedWorldBackgrounds:true/, 'v20 runtime must advertise approved world backgrounds');
assert.match(v20Runtime, /phenotypeForms:\['plant','fire','electric','ice'\]/, 'v20 runtime must expose canonical phenotype forms');
assert.match(v20Runtime, /blight-king/, 'v20 runtime must own Blight King finale');
assert.match(v20Runtime, /eco-city/, 'v20 runtime must own Eco City');
assert.doesNotMatch(v20Runtime, /Genome Hydra|Genetic Frontier/, 'retired World 5 contract leaked into canonical v20 runtime');
assert.match(v20Ui, /seed-man-campaign-ui-v20/, 'v20 campaign UI marker missing');
assert.match(approvedCore, /seed-man-approved-art-core-v3/, 'approved art core v3 marker missing');
for (const world of ['greenhouse-valley','forest-ruins','desert-canyon','frozen-peaks','eco-city']) {
  assert.ok(approvedCore.includes(`world.${world}.background`), `approved browser art registry missing ${world}`);
}
assert.match(approvedCore, /seed-man-approved-master-atlas-v1\.webp/, 'approved browser art registry must source world art from the master atlas');

console.log('Seed Man canonical v20 campaign, v3 approved world art, and retired artifact removal checks passed');
