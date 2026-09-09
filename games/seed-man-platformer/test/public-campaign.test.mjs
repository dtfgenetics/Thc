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

// Retained legacy packs are compatibility artifacts only. They must remain
// canonical/public identical while old adapters still reference them, but they
// are not allowed to redefine the production campaign contract.
assert.deepStrictEqual(publicBasePack, basePack, 'legacy Levels 2–11 compatibility pack must remain synchronized');
assert.deepStrictEqual(publicLegacyWorldFive, legacyWorldFive, 'legacy Levels 12–15 compatibility pack must remain synchronized');
assert.equal(basePack.levels.length, 10);
assert.equal(legacyWorldFive.levels.length, 4);
assert.deepStrictEqual(legacyWorldFive.levels.map((entry) => entry.id), ['chromosome-crossing', 'mutation-marsh', 'allele-array', 'genome-spire']);

assert.match(html, /campaign-v20-runtime\.js\?v=20260908-v20/, 'public page must load canonical v20 campaign runtime');
assert.match(html, /campaign-ui-v20\.js\?v=20260908-v20/, 'public page must load canonical v20 campaign UI');
assert.match(v20Runtime, /seed-man-campaign-v20-runtime-v1/, 'v20 runtime marker missing');
assert.match(v20Runtime, /blight-king/, 'v20 runtime must own Blight King finale');
assert.match(v20Runtime, /eco-city/, 'v20 runtime must own Eco City');
assert.doesNotMatch(v20Runtime, /Genome Hydra|Genetic Frontier/, 'retired World 5 contract leaked into canonical v20 runtime');
assert.match(v20Ui, /seed-man-campaign-ui-v20/, 'v20 campaign UI marker missing');

// Compatibility adapters may remain while migration consumers still exist,
// but they must remain self-contained and must not replace v20 ownership.
assert.match(legacyBaseRuntime, /seed-man-campaign-v1-compat-retired/, 'legacy base shim must expose its retired compatibility version');
assert.match(legacyBaseRuntime, /retired:\s*true/, 'legacy base shim must identify itself as retired');
assert.match(legacyBaseRuntime, /replacement:\s*'seed-man-campaign-v20-runtime-v1'/, 'legacy base shim must point to canonical v20 ownership');
assert.doesNotMatch(legacyBaseRuntime, /sprout-campaign-v3|levelCount:\s*11|newLevelCount:\s*10/, 'retired base shim must not reinstall the obsolete campaign');
assert.doesNotMatch(legacyBaseRuntime, /addEventListener\s*\(\s*['"]load['"]|MutationObserver|fetch\s*\(/i, 'retired base shim must stay side-effect-light and network free');
assert.match(legacyWorldFiveRuntime, /seed-man-world-five-v1/, 'legacy World 5 compatibility adapter missing');
assert.match(legacyWorldFiveRuntime, /installCampaignExtension/, 'legacy World 5 adapter must remain an extension only');
assert.doesNotMatch(legacyWorldFiveRuntime, /^\s*import\s/m, 'legacy World 5 adapter must remain a classic browser script');
assert.doesNotMatch(legacyWorldFiveRuntime, /fetch\s*\(/i, 'legacy World 5 adapter must not add network dependencies');

console.log('Seed Man canonical v20 public campaign and legacy compatibility boundary checks passed');
