import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('../../../site/public-route-patch/games/seed-man-platformer/', import.meta.url);

const [
  canonicalCampaignText,
  publicCampaignText,
  canonicalPackText,
  publicPackText,
  canonicalLevelText,
  html,
  runtime
] = await Promise.all([
  readFile(new URL('data/campaign.json', root), 'utf8'),
  readFile(new URL('data/campaign.json', publicRoot), 'utf8'),
  readFile(new URL('data/levels-02-11.json', root), 'utf8'),
  readFile(new URL('data/levels-02-11.json', publicRoot), 'utf8'),
  readFile(new URL('data/level-01.json', root), 'utf8'),
  readFile(new URL('index.html', publicRoot), 'utf8'),
  readFile(new URL('campaign-v1.js', publicRoot), 'utf8')
]);

const campaign = JSON.parse(canonicalCampaignText);
const publicCampaign = JSON.parse(publicCampaignText);
const pack = JSON.parse(canonicalPackText);
const publicPack = JSON.parse(publicPackText);
const levelOne = JSON.parse(canonicalLevelText);

assert.deepStrictEqual(publicCampaign, campaign, 'public campaign manifest must match canonical campaign data');
assert.deepStrictEqual(publicPack, pack, 'public generated-level pack must match canonical level definitions');
assert.equal(campaign.defaultLevelId, levelOne.id, 'campaign default must keep the proven Greenhouse Gauntlet');
assert.equal(campaign.worlds.length, 4);
assert.equal(campaign.levelCount, 11);
assert.equal(campaign.newLevelCount, 10);
assert.equal(campaign.worlds.flatMap((world) => world.levels).length, 11);
assert.equal(pack.levels.length, 10);
assert.equal(pack.levels.filter((entry) => entry.boss).length, 4);

const embeddedLevelMatch = html.match(/<script\s+id=["']seed-man-level["']\s+type=["']application\/json["']>\s*([\s\S]*?)\s*<\/script>/i);
assert.ok(embeddedLevelMatch, 'public page must keep Level 1 embedded for immediate startup');
assert.deepStrictEqual(JSON.parse(embeddedLevelMatch[1]), levelOne, 'embedded Level 1 must match canonical Greenhouse Gauntlet');
assert.match(html, /id=["']seed-man-campaign["']/, 'public page must expose the campaign manifest slot');

const campaignScriptIndex = html.indexOf('./campaign-v1.js?');
const appScriptIndex = html.indexOf('./app.js?');
assert.ok(campaignScriptIndex >= 0, 'public page must load campaign-v1.js');
assert.ok(appScriptIndex > campaignScriptIndex, 'campaign manifest bootstrap must load before the existing gameplay runtime');

for (const marker of [
  'sprout-campaign-v3',
  'seed-man-campaign-experience-v3',
  'seed-man-animation-v2',
  'levelCount: 11',
  'newLevelCount: 10',
  'bossCount: 4',
  'The Phantom Pump',
  'Mite Queen',
  'Mildew Wraith',
  'Pollen Warden',
  'Nursery Night Shift',
  'Cloud Nine Citadel',
  'bounce-pads',
  'flow-zones',
  'drag-zones',
  'updraft-zones',
  'boost-zones',
  'heat-vents',
  'gust-zones',
  'slip-zones',
  'wind-zones',
  'seed-man-level-select',
  'seed-man-next-level',
  '__SPROUT_CAMPAIGN_EXPERIENCE__',
  '__SPROUT_ANIMATION_V2__',
  'boss-stomp',
  'landing-squash',
  'finish-celebration',
  'chubby-seed-silhouette',
  'three-leaf-sprout',
  'rubber-hose-limbs'
]) {
  assert.ok(runtime.includes(marker), `public campaign runtime is missing ${marker}`);
}

assert.match(runtime, /manifestNode\.textContent\s*=\s*JSON\.stringify\(SPROUT_CAMPAIGN_MANIFEST\)/, 'runtime must replace the foundation manifest with the full 11-level contract');
assert.match(runtime, /window\.addEventListener\(['"]load['"]/, 'campaign mechanics must wait for the proven base runtime to finish loading');
assert.match(runtime, /level\.id\s*===\s*['"]sprout-run['"]/, 'Level 1 must retain its existing gameplay-v2 path');
assert.match(runtime, /stepGeneratedPlayer/, 'new levels need a dedicated base-physics path instead of inheriting Level 1-only pests and moving tables');
assert.match(runtime, /resolveBoss/, 'boss collisions must be part of gameplay state');
assert.match(runtime, /drawBoss/, 'bosses must be visually rendered');
assert.match(runtime, /drawGeneratedPlatforms/, 'new settings must render their own stage geometry');
assert.match(runtime, /drawSeedMan\s*=\s*function seedManAnimationV2/, 'Seed Man animation-v2 must replace the old render pose layer after startup');
assert.match(runtime, /prefers-reduced-motion:reduce/, 'campaign UI must preserve reduced-motion behavior');
assert.doesNotMatch(runtime, /^\s*import\s/m, 'campaign runtime must remain a classic self-contained browser script');
assert.doesNotMatch(runtime, /fetch\s*\(/i, 'campaign runtime must not introduce runtime network dependencies');
assert.doesNotMatch(runtime, /campaign-expansion-v2\.js|seed-man-animation-v2\.js/, 'production campaign must not depend on unallowlisted split runtime files');

console.log('Seed Man public 11-level campaign, boss, setting, and animation-v2 checks passed');
