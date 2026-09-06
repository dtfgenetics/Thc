import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCampaignState, flattenCampaignLevels, validateCampaign } from '../src/campaign.mjs';
import { generateCoursePack } from '../src/course-generator.mjs';

const campaign = JSON.parse(fs.readFileSync(new URL('../data/campaign.json', import.meta.url)));
const levelOne = JSON.parse(fs.readFileSync(new URL('../data/level-01.json', import.meta.url)));
const coursePack = JSON.parse(fs.readFileSync(new URL('../data/levels-02-11.json', import.meta.url)));

assert.equal(validateCampaign(campaign), campaign);
assert.equal(campaign.defaultLevelId, levelOne.id, 'campaign default must preserve the proven Greenhouse Gauntlet');
assert.equal(campaign.levelCount, 11, 'Seed Man Run must expose eleven total levels');
assert.equal(campaign.newLevelCount, 10, 'campaign must add ten new levels beyond Greenhouse Gauntlet');
assert.equal(campaign.worlds.length, 4, 'campaign should progress through four themed worlds');

const levels = flattenCampaignLevels(campaign);
assert.equal(levels.length, 11);
assert.deepStrictEqual(levels.map((level) => level.order), Array.from({ length: 11 }, (_, index) => index + 1));
assert.ok(levels.every((level) => level.status === 'playable'), 'all eleven levels should be directly playable in this release');
assert.equal(levels[0].id, 'sprout-run');
assert.equal(levels[0].dataPath, 'data/level-01.json');
assert.equal(levels[10].id, 'cloud-nine-citadel');
assert.equal(levels[10].worldId, 'world-04');

const generated = generateCoursePack(coursePack);
assert.equal(generated.length, 10, 'course generator must materialize all ten new stages');
assert.deepStrictEqual(
  generated.map((level) => level.id),
  levels.slice(1).map((level) => level.id),
  'generated level order must match the campaign manifest'
);

let previousDifficulty = 0;
for (const [index, level] of generated.entries()) {
  const manifest = levels[index + 1];
  assert.equal(level.schemaVersion, 2, `${level.id} must use the current level schema`);
  assert.equal(level.levelNumber, index + 2, `${level.id} has the wrong level number`);
  assert.equal(manifest.dataKey, level.id, `${level.id} manifest dataKey mismatch`);
  assert.equal(manifest.dataPath, 'data/levels-02-11.json', `${level.id} must use the shared generated course pack`);
  assert.ok(level.worldWidth >= 4200 && level.worldWidth <= 6200, `${level.id} world width is outside the campaign budget`);
  assert.equal(level.worldHeight, 540, `${level.id} must preserve the established viewport physics height`);
  assert.equal(level.pickups.length, level.requiredPickups, `${level.id} pickup gate mismatch`);
  assert.ok(level.platforms.length >= 12, `${level.id} needs enough geometry to be a full stage`);
  assert.ok(level.hazards.length >= 8, `${level.id} needs a meaningful hazard layout`);
  assert.ok(level.powerups.length >= 3, `${level.id} needs power-up routing choices`);
  assert.ok(level.checkpoints.length >= 2, `${level.id} needs recovery checkpoints`);
  assert.ok(level.finish.x > level.worldWidth * 0.75 && level.finish.x < level.worldWidth, `${level.id} finish gate must be late in the course`);
  assert.ok(level.spawn.x >= 0 && level.spawn.x < level.worldWidth, `${level.id} spawn must stay in bounds`);
  assert.ok(level.difficulty >= previousDifficulty, `${level.id} difficulty must not regress`);
  previousDifficulty = level.difficulty;

  const pickupIds = level.pickups.map((pickup) => pickup.id);
  assert.equal(new Set(pickupIds).size, pickupIds.length, `${level.id} pickup ids must be unique`);
  const powerIds = level.powerups.map((powerup) => powerup.id);
  assert.equal(new Set(powerIds).size, powerIds.length, `${level.id} power-up ids must be unique`);
  const checkpointIds = level.checkpoints.map((checkpoint) => checkpoint.id);
  assert.equal(new Set(checkpointIds).size, checkpointIds.length, `${level.id} checkpoint ids must be unique`);

  for (const rectangle of [...level.platforms, ...level.hazards, ...level.pickups, ...level.powerups, ...level.checkpoints, level.finish]) {
    assert.ok(Number.isFinite(rectangle.x) && Number.isFinite(rectangle.y), `${level.id} contains non-finite coordinates`);
    assert.ok(rectangle.width > 0 && rectangle.height > 0, `${level.id} contains invalid rectangle dimensions`);
    assert.ok(rectangle.x >= 0 && rectangle.x + rectangle.width <= level.worldWidth + 1, `${level.id} contains out-of-bounds geometry`);
  }

  const ground = level.platforms.filter((platform) => platform.y === 480 && platform.height === 60).sort((a, b) => a.x - b.x);
  for (let groundIndex = 1; groundIndex < ground.length; groundIndex += 1) {
    const gap = ground[groundIndex].x - (ground[groundIndex - 1].x + ground[groundIndex - 1].width);
    assert.ok(gap >= 0 && gap <= 150, `${level.id} generated an unsafe horizontal gap of ${gap}px`);
  }
}

const state = createCampaignState(campaign);
assert.deepStrictEqual(state, {
  campaignId: 'sprout-run-campaign',
  activeLevelId: 'sprout-run',
  worldId: 'world-01',
  levelOrder: 1,
  worldOrder: 1
});

const finalState = createCampaignState(campaign, 'cloud-nine-citadel');
assert.equal(finalState.levelOrder, 11);
assert.equal(finalState.worldId, 'world-04');
assert.equal(finalState.worldOrder, 4);
assert.throws(() => createCampaignState(campaign, 'missing-level'), /unknown campaign level/);

const duplicate = structuredClone(campaign);
duplicate.worlds[0].levels.push({ ...duplicate.worlds[0].levels[0] });
assert.throws(() => validateCampaign(duplicate), /duplicate campaign level/);

const locked = structuredClone(campaign);
locked.worlds[3].levels[1].status = 'locked';
assert.throws(() => createCampaignState(locked, 'cloud-nine-citadel'), /not playable/);

console.log('Seed Man eleven-level campaign tests passed');
