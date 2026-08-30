import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('../../../site/public-route-patch/games/seed-man-platformer/', import.meta.url);

const [canonicalCampaignText, publicCampaignText, canonicalLevelText, html, runtime] = await Promise.all([
  readFile(new URL('data/campaign.json', root), 'utf8'),
  readFile(new URL('data/campaign.json', publicRoot), 'utf8'),
  readFile(new URL('data/level-01.json', root), 'utf8'),
  readFile(new URL('index.html', publicRoot), 'utf8'),
  readFile(new URL('campaign-v1.js', publicRoot), 'utf8')
]);

const campaign = JSON.parse(canonicalCampaignText);
const publicCampaign = JSON.parse(publicCampaignText);
const level = JSON.parse(canonicalLevelText);

assert.deepStrictEqual(publicCampaign, campaign, 'public campaign manifest must match canonical campaign data');
assert.equal(campaign.defaultLevelId, level.id, 'campaign default must keep the proven Sprout Run level');
assert.equal(campaign.worlds.length, 1, 'foundation release should keep one world until Level 2 is tested');
assert.equal(campaign.worlds[0].levels.length, 1, 'foundation release should keep exactly one playable level');

const campaignMatch = html.match(/<script\s+id=["']seed-man-campaign["']\s+type=["']application\/json["']>\s*([\s\S]*?)\s*<\/script>/i);
assert.ok(campaignMatch, 'public page must embed campaign data');
assert.deepStrictEqual(JSON.parse(campaignMatch[1]), campaign, 'embedded campaign manifest must match canonical campaign data');

const campaignScriptIndex = html.indexOf('./campaign-v1.js?');
const appScriptIndex = html.indexOf('./app.js?');
assert.ok(campaignScriptIndex >= 0, 'public page must load campaign-v1.js');
assert.ok(appScriptIndex > campaignScriptIndex, 'campaign runtime must load before the existing gameplay runtime');
assert.match(runtime, /sprout-campaign-v1/, 'campaign runtime must expose a versioned contract');
assert.match(runtime, /campaign default level does not match embedded gameplay level/, 'campaign runtime must guard default-level parity');
assert.match(runtime, /sprout:level-selected/, 'campaign runtime must expose a future-safe level selection event');
assert.doesNotMatch(runtime, /^\s*import\s/m, 'campaign runtime must remain a classic self-contained browser script');
assert.doesNotMatch(runtime, /fetch\s*\(/i, 'campaign runtime must not introduce a network dependency');

console.log('Seed Man public campaign foundation checks passed');
