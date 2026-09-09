import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCampaignState, flattenCampaignLevels, validateCampaign } from '../src/campaign.mjs';

const campaign = JSON.parse(fs.readFileSync(new URL('../data/campaign.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(new URL('../data/levels-20-v1.json', import.meta.url), 'utf8'));

assert.equal(validateCampaign(campaign), campaign);
assert.equal(campaign.defaultLevelId, '1-1-sprout-steps');
assert.equal(campaign.levelCount, 20);
assert.equal(campaign.newLevelCount, 19);
assert.equal(campaign.worlds.length, 5);
assert.equal(campaign.finalBoss, 'blight-king');

const levels = flattenCampaignLevels(campaign);
assert.equal(levels.length, 20);
assert.deepStrictEqual(levels.map((entry) => entry.order), Array.from({ length: 20 }, (_, index) => index + 1));
assert.ok(levels.every((entry) => entry.status === 'playable'));
assert.ok(levels.every((entry) => entry.dataPath === 'data/levels-20-v1.json'));
assert.deepStrictEqual(campaign.worlds.map((world) => world.levels.length), [4,4,4,4,4]);
assert.deepStrictEqual(campaign.worlds.map((world) => world.title), ['Greenhouse Valley','Forest Ruins','Desert Canyon','Frozen Peaks','Eco City']);
assert.deepStrictEqual(campaign.worlds.map((world) => world.visualWorldKey), ['greenhouse-valley','forest-ruins','desert-canyon','frozen-peak','eco-city']);

assert.equal(catalog.schemaVersion, 1);
assert.equal(catalog.id, 'seed-man-levels-20-v1');
assert.equal(catalog.levels.length, 20);
assert.deepStrictEqual(catalog.levels.map((entry) => entry.id), levels.map((entry) => entry.id));
assert.deepStrictEqual(catalog.levels.map((entry) => entry.order), levels.map((entry) => entry.order));
assert.ok(catalog.levels.every((entry) => entry.length >= 5000 && entry.length <= 9000));
assert.ok(catalog.levels.every((entry) => entry.checkpointCount >= 2));
assert.ok(catalog.levels.every((entry) => entry.enemyPool.length >= 2));
assert.ok(catalog.levels.every((entry) => entry.hazards.length >= 1));
assert.ok(catalog.levels.every((entry) => entry.mechanics.length >= 1));

const bosses = catalog.levels.filter((entry) => entry.boss);
assert.equal(bosses.length, 6);
assert.deepStrictEqual(bosses.map((entry) => entry.boss), ['overgrown-guardian','ancient-dryad','scorchroot-titan','frostbite-colossus','eco-sentinel','blight-king']);
assert.deepStrictEqual(bosses.map((entry) => entry.order), [4,8,12,16,19,20]);

const finale = levels.at(-1);
assert.equal(finale.id, '5-4-the-last-seed');
assert.equal(finale.worldId, 'world-05');
assert.equal(finale.worldTitle, 'Eco City');
assert.equal(finale.boss, 'blight-king');
assert.equal(finale.finalBoss, true);
assert.equal(finale.phases, 4);
const finaleData = catalog.levels.at(-1);
assert.equal(finaleData.boss, 'blight-king');
assert.ok(finaleData.mechanics.includes('final-gauntlet'));
assert.ok(finaleData.mechanics.includes('phenotype-cycle'));

const state = createCampaignState(campaign);
assert.deepStrictEqual(state, {
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

console.log('Seed Man 20-level campaign, five worlds, six bosses, and Blight King finale tests passed');
