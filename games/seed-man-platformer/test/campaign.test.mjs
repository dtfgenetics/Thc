import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCampaignState, flattenCampaignLevels, validateCampaign } from '../src/campaign.mjs';

const campaign = JSON.parse(fs.readFileSync(new URL('../data/campaign.json', import.meta.url)));
const level = JSON.parse(fs.readFileSync(new URL('../data/level-01.json', import.meta.url)));

assert.equal(validateCampaign(campaign), campaign);
assert.equal(campaign.defaultLevelId, level.id, 'campaign default must preserve the currently proven Sprout Run level');

const levels = flattenCampaignLevels(campaign);
assert.equal(levels.length, 1, 'foundation release must introduce no new gameplay level yet');
assert.equal(levels[0].id, 'sprout-run');
assert.equal(levels[0].status, 'playable');
assert.equal(levels[0].dataPath, 'data/level-01.json');
assert.equal(levels[0].publicDataElementId, 'seed-man-level');

const state = createCampaignState(campaign);
assert.deepStrictEqual(state, {
  campaignId: 'sprout-run-campaign',
  activeLevelId: 'sprout-run',
  worldId: 'world-01',
  levelOrder: 1,
  worldOrder: 1
});

assert.throws(() => createCampaignState(campaign, 'missing-level'), /unknown campaign level/);

const duplicate = structuredClone(campaign);
duplicate.worlds[0].levels.push({ ...duplicate.worlds[0].levels[0] });
assert.throws(() => validateCampaign(duplicate), /duplicate campaign level/);

const locked = structuredClone(campaign);
locked.worlds[0].levels[0].status = 'locked';
assert.throws(() => createCampaignState(locked), /not playable/);

console.log('Seed Man campaign foundation tests passed');
