import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCampaignState, flattenCampaignLevels, validateCampaign } from '../src/campaign.mjs';

const campaign = JSON.parse(fs.readFileSync(new URL('../data/campaign.json', import.meta.url)));
const legacyLevelOne = JSON.parse(fs.readFileSync(new URL('../data/level-01.json', import.meta.url)));
const levelPack = JSON.parse(fs.readFileSync(new URL('../data/levels-20-v1.json', import.meta.url)));

assert.equal(validateCampaign(campaign), campaign);
assert.equal(campaign.levelCount, 20, 'Seed Man must expose the current twenty-level campaign');
assert.equal(campaign.newLevelCount, 19, 'campaign must expose nineteen levels beyond the legacy compatibility stage');
assert.equal(campaign.worlds.length, 5, 'campaign must progress through five themed worlds');
assert.equal(campaign.defaultLevelId, '1-1-sprout-steps', 'current campaign must start at Sprout Steps');
assert.equal(campaign.finalBoss, 'blight-king', 'current campaign final boss contract must remain Blight King');

const levels = flattenCampaignLevels(campaign);
assert.equal(levels.length, 20);
assert.deepStrictEqual(levels.map((entry) => entry.order), Array.from({ length: 20 }, (_, index) => index + 1));
assert.ok(levels.every((entry) => entry.status === 'playable'), 'all twenty levels must be directly playable');
assert.equal(levels[0].id, '1-1-sprout-steps');
assert.equal(levels[0].dataPath, 'data/levels-20-v1.json');
assert.equal(levels[0].worldId, 'world-01');
assert.equal(levels[3].boss, 'overgrown-guardian');
assert.equal(levels[7].boss, 'ancient-dryad');
assert.equal(levels[11].boss, 'scorchroot-titan');
assert.equal(levels[15].boss, 'frostbite-colossus');
assert.equal(levels[18].boss, 'eco-sentinel');
assert.equal(levels[19].id, '5-4-the-last-seed');
assert.equal(levels[19].boss, 'blight-king');
assert.equal(levels[19].finalBoss, true);
assert.equal(levels[19].phases, 4);
assert.equal(levels[19].worldId, 'world-05');
assert.equal(levels[19].worldTitle, 'Eco City');

assert.equal(legacyLevelOne.id, 'sprout-run', 'legacy sprout-run ID must remain available for compatibility');
assert.notEqual(campaign.defaultLevelId, legacyLevelOne.id, 'legacy compatibility ID must not overwrite the current campaign start');

assert.ok(Array.isArray(levelPack.levels), 'twenty-level data pack must expose a levels array');
assert.equal(levelPack.levels.length, 20, 'twenty-level data pack must contain all campaign stages');
const packedIds = new Set(levelPack.levels.map((entry) => entry.id));
for (const level of levels) {
  assert.ok(packedIds.has(level.dataKey), `missing packed level data for ${level.id}`);
}

const defaultState = createCampaignState(campaign);
assert.deepStrictEqual(defaultState, {
  campaignId: 'sprout-run-campaign',
  activeLevelId: '1-1-sprout-steps',
  worldId: 'world-01',
  levelOrder: 1,
  worldOrder: 1
});

const finalState = createCampaignState(campaign, '5-4-the-last-seed');
assert.equal(finalState.levelOrder, 20);
assert.equal(finalState.worldId, 'world-05');
assert.equal(finalState.worldOrder, 5);
assert.throws(() => createCampaignState(campaign, 'missing-level'), /unknown campaign level/);

const duplicate = structuredClone(campaign);
duplicate.worlds[0].levels.push({ ...duplicate.worlds[0].levels[0] });
assert.throws(() => validateCampaign(duplicate), /duplicate campaign level/);

const locked = structuredClone(campaign);
locked.worlds[4].levels[3].status = 'locked';
assert.throws(() => createCampaignState(locked, '5-4-the-last-seed'), /not playable/);

console.log('Seed Man twenty-level campaign contract tests passed');
