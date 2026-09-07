import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('../../../site/public-route-patch/games/seed-man-platformer/', import.meta.url);

const [
  canonicalCampaignText,
  publicCampaignText,
  canonicalBasePackText,
  publicBasePackText,
  canonicalWorldFivePackText,
  publicWorldFivePackText,
  canonicalLevelText,
  html,
  baseRuntime,
  worldFiveRuntime
] = await Promise.all([
  readFile(new URL('data/campaign.json', root), 'utf8'),
  readFile(new URL('data/campaign.json', publicRoot), 'utf8'),
  readFile(new URL('data/levels-02-11.json', root), 'utf8'),
  readFile(new URL('data/levels-02-11.json', publicRoot), 'utf8'),
  readFile(new URL('data/levels-12-15.json', root), 'utf8'),
  readFile(new URL('data/levels-12-15.json', publicRoot), 'utf8'),
  readFile(new URL('data/level-01.json', root), 'utf8'),
  readFile(new URL('index.html', publicRoot), 'utf8'),
  readFile(new URL('campaign-v1.js', publicRoot), 'utf8'),
  readFile(new URL('world-five-v1.js', publicRoot), 'utf8')
]);

const campaign = JSON.parse(canonicalCampaignText);
const publicCampaign = JSON.parse(publicCampaignText);
const basePack = JSON.parse(canonicalBasePackText);
const publicBasePack = JSON.parse(publicBasePackText);
const worldFivePack = JSON.parse(canonicalWorldFivePackText);
const publicWorldFivePack = JSON.parse(publicWorldFivePackText);
const levelOne = JSON.parse(canonicalLevelText);

assert.deepStrictEqual(publicCampaign, campaign, 'public campaign manifest must match canonical campaign data');
assert.deepStrictEqual(publicBasePack, basePack, 'public Levels 2–11 pack must match canonical definitions');
assert.deepStrictEqual(publicWorldFivePack, worldFivePack, 'public Levels 12–15 pack must match canonical definitions');
assert.equal(campaign.defaultLevelId, levelOne.id, 'campaign default must keep Greenhouse Gauntlet');
assert.equal(campaign.worlds.length, 5);
assert.equal(campaign.levelCount, 15);
assert.equal(campaign.newLevelCount, 14);
assert.equal(campaign.worlds.flatMap((world) => world.levels).length, 15);
assert.equal(basePack.levels.length, 10);
assert.equal(worldFivePack.levels.length, 4);
assert.deepStrictEqual(worldFivePack.levels.map((entry) => entry.id), ['chromosome-crossing', 'mutation-marsh', 'allele-array', 'genome-spire']);
assert.equal(worldFivePack.levels.at(-1).boss?.name, 'Genome Hydra');

const embeddedLevelMatch = html.match(/<script\s+id=["']seed-man-level["']\s+type=["']application\/json["']>\s*([\s\S]*?)\s*<\/script>/i);
assert.ok(embeddedLevelMatch, 'public page must keep Level 1 embedded for immediate startup');
assert.deepStrictEqual(JSON.parse(embeddedLevelMatch[1]), levelOne, 'embedded Level 1 must match Greenhouse Gauntlet');
assert.match(html, /id=["']seed-man-campaign["']/, 'public page must expose the campaign manifest slot');

const release = html.match(/name="dtf-sprout-release" content="([^"]+)"/)?.[1];
assert.ok(release, 'public page must expose a release marker');
const baseScriptIndex = html.indexOf(`./campaign-v1.js?v=${release}`);
const appScriptIndex = html.indexOf(`./app.js?v=${release}`);
const worldFiveScriptIndex = html.indexOf(`./world-five-v1.js?v=${release}`);
assert.ok(baseScriptIndex >= 0, 'public page must load campaign-v1.js');
assert.ok(appScriptIndex > baseScriptIndex, 'campaign bootstrap must load before app.js');
assert.ok(worldFiveScriptIndex > appScriptIndex, 'prepared public page must load World 5 after the base runtime');

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
  'seed-man-level-select',
  '__SPROUT_CAMPAIGN_EXPERIENCE__',
  'boss-stomp',
  'finish-celebration'
]) {
  assert.ok(baseRuntime.includes(marker), `base campaign runtime is missing ${marker}`);
}

for (const marker of [
  'seed-man-world-five-v1',
  'Genetic Frontier',
  'Chromosome Crossing',
  'Mutation Marsh',
  'Allele Array',
  'Genome Spire',
  'Voltage Wasp Alpha',
  'Genome Hydra',
  'levelCount: 15',
  'newLevelCount: 14',
  'sproutWorldFive'
]) {
  assert.ok(worldFiveRuntime.includes(marker), `World 5 runtime is missing ${marker}`);
}

assert.match(baseRuntime, /window\.addEventListener\(['"]load['"]/, 'base campaign mechanics must wait for startup');
assert.match(baseRuntime, /stepGeneratedPlayer/, 'Levels 2–11 retain the generated physics path');
assert.match(baseRuntime, /resolveBoss/, 'base boss collisions remain gameplay state');
assert.match(worldFiveRuntime, /selectFrontierLevel/, 'World 5 must own explicit frontier selection');
assert.match(worldFiveRuntime, /installCampaignExtension/, 'World 5 must extend, not replace, the proven campaign runtime');
assert.match(worldFiveRuntime, /installVisualLayer/, 'World 5 must install its distinct visual layer');
assert.doesNotMatch(worldFiveRuntime, /^\s*import\s/m, 'World 5 runtime must remain a classic self-contained browser script');
assert.doesNotMatch(worldFiveRuntime, /fetch\s*\(/i, 'World 5 runtime must not add network dependencies');

console.log('Seed Man public 15-level campaign, Genetic Frontier extension, bosses, and source parity checks passed');