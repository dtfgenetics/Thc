import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('../../../site/public-route-patch/games/seed-man-platformer/', import.meta.url);

const [
  canonicalCampaignText,
  publicCampaignText,
  canonicalLevels20Text,
  publicLevels20Text,
  canonicalBasePackText,
  publicBasePackText,
  canonicalLegacyWorldFiveText,
  publicLegacyWorldFiveText,
  html,
  v20Runtime,
  v20Ui,
  legacyBaseRuntime,
  legacyWorldFiveRuntime
] = await Promise.all([
  readFile(new URL('data/campaign.json', root), 'utf8'),
  readFile(new URL('data/campaign.json', publicRoot), 'utf8'),
  readFile(new URL('data/levels-20-v1.json', root), 'utf8'),
  readFile(new URL('data/levels-20-v1.json', publicRoot), 'utf8'),
  readFile(new URL('data/levels-02-11.json', root), 'utf8'),
  readFile(new URL('data/levels-02-11.json', publicRoot), 'utf8'),
  readFile(new URL('data/levels-12-15.json', root), 'utf8'),
  readFile(new URL('data/levels-12-15.json', publicRoot), 'utf8'),
  readFile(new URL('index.html', publicRoot), 'utf8'),
  readFile(new URL('campaign-v20-runtime.js', publicRoot), 'utf8'),
  readFile(new URL('campaign-ui-v20.js', publicRoot), 'utf8'),
  readFile(new URL('campaign-v1.js', publicRoot), 'utf8'),
  readFile(new URL('world-five-v1.js', publicRoot), 'utf8')
]);

const campaign = JSON.parse(canonicalCampaignText);
const publicCampaign = JSON.parse(publicCampaignText);
const levels20 = JSON.parse(canonicalLevels20Text);
const publicLevels20 = JSON.parse(publicLevels20Text);
const basePack = JSON.parse(canonicalBasePackText);
const publicBasePack = JSON.parse(publicBasePackText);
const legacyWorldFive = JSON.parse(canonicalLegacyWorldFiveText);
const publicLegacyWorldFive = JSON.parse(publicLegacyWorldFiveText);

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

// Retained legacy data packs are compatibility artifacts only. They must remain
// canonical/public identical while old URLs still exist, but they are not
// allowed to redefine the production campaign contract.
assert.deepStrictEqual(publicBasePack, basePack, 'legacy Levels 2–11 compatibility pack must remain synchronized');
assert.deepStrictEqual(publicLegacyWorldFive, legacyWorldFive, 'legacy Levels 12–15 compatibility pack must remain synchronized');
assert.equal(basePack.levels.length, 10);
assert.equal(legacyWorldFive.levels.length, 4);
assert.deepStrictEqual(legacyWorldFive.levels.map((entry) => entry.id), ['chromosome-crossing', 'mutation-marsh', 'allele-array', 'genome-spire']);

// Asset query strings are cache-busters, not runtime identity. Verify the
// canonical scripts are loaded without freezing a dated release token.
assert.match(html, /campaign-v20-runtime\.js\?v=[^"']+/, 'public page must load canonical v20 campaign runtime');
assert.match(html, /campaign-ui-v20\.js\?v=[^"']+/, 'public page must load canonical v20 campaign UI');
assert.match(html, /v20-enemy-runtime\.js\?v=[^"']+/, 'public page must load canonical v20 enemy runtime');
assert.match(html, /combat-browser-v2\.js\?v=[^"']+/, 'public page must load canonical v20 combat runtime');
assert.match(html, /enemy-attacks-browser-v2\.js\?v=[^"']+/, 'public page must load canonical v20 enemy attack runtime');
assert.doesNotMatch(html, /combat-browser-v1\.js|enemy-attacks-browser-v1\.js/, 'public page must not load legacy combat adapters');
assert.match(v20Runtime, /seed-man-campaign-v20-runtime-v2/, 'v20 runtime v2 marker missing');
assert.match(v20Runtime, /phenotypeForms:\['plant','fire','electric','ice'\]/, 'v20 runtime must expose canonical phenotype forms');
assert.match(v20Runtime, /blight-king/, 'v20 runtime must own Blight King finale');
assert.match(v20Runtime, /eco-city/, 'v20 runtime must own Eco City');
assert.doesNotMatch(v20Runtime, /Genome Hydra|Genetic Frontier/, 'retired World 5 contract leaked into canonical v20 runtime');
assert.match(v20Ui, /seed-man-campaign-ui-v20/, 'v20 campaign UI marker missing');

// Compatibility paths may remain while cached clients still request them, but
// both old script URLs must now hand ownership to v20 rather than reinstalling
// the retired 11/15-level campaign.
assert.match(legacyBaseRuntime, /seed-man-campaign-v1-compat-retired/, 'legacy base shim must expose its retired compatibility version');
assert.match(legacyBaseRuntime, /retired:\s*true/, 'legacy base shim must identify itself as retired');
assert.match(legacyBaseRuntime, /replacement:\s*'seed-man-campaign-v20-runtime-v1'/, 'legacy base shim must point to canonical v20 ownership');
assert.doesNotMatch(legacyBaseRuntime, /sprout-campaign-v3|levelCount:\s*11|newLevelCount:\s*10/, 'retired base shim must not reinstall the obsolete campaign');
assert.doesNotMatch(legacyBaseRuntime, /addEventListener\s*\(\s*['"]load['"]|MutationObserver|fetch\s*\(/i, 'retired base shim must stay side-effect-light and network free');

assert.match(legacyWorldFiveRuntime, /seed-man-world-five-compat-v22/, 'legacy World 5 URL must expose its v20 compatibility bridge');
assert.match(legacyWorldFiveRuntime, /seedManLegacyWorldFive='retired'/, 'legacy World 5 bridge must mark the old extension retired');
assert.match(legacyWorldFiveRuntime, /campaignTarget:20/, 'legacy World 5 bridge must target the 20-level campaign');
for (const required of ['approved-art-core-v1.js','campaign-v20-runtime.js','campaign-combat-v20.js','campaign-progress-v20.js','campaign-ui-v20.js']) {
  assert.ok(legacyWorldFiveRuntime.includes(required), `legacy World 5 bridge must bootstrap ${required}`);
}
assert.doesNotMatch(legacyWorldFiveRuntime, /installCampaignExtension|Genome Hydra|Genetic Frontier|Voltage Wasp Alpha/, 'legacy World 5 bridge must not reinstall retired World 5 ownership');
assert.doesNotMatch(legacyWorldFiveRuntime, /^\s*import\s/m, 'legacy World 5 bridge must remain a classic browser script');
assert.doesNotMatch(legacyWorldFiveRuntime, /fetch\s*\(/i, 'legacy World 5 bridge must not add fetch-based data ownership');

console.log('Seed Man canonical v20 public campaign and retired compatibility bridge checks passed');
