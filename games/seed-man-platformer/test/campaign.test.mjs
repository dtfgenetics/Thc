import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCampaignState, flattenCampaignLevels, validateCampaign } from '../src/campaign.mjs';
import { generateCoursePack } from '../src/course-generator.mjs';

const campaign = JSON.parse(fs.readFileSync(new URL('../data/campaign.json', import.meta.url)));
const levelOne = JSON.parse(fs.readFileSync(new URL('../data/level-01.json', import.meta.url)));
const corePack = JSON.parse(fs.readFileSync(new URL('../data/levels-02-11.json', import.meta.url)));
const frontierPack = JSON.parse(fs.readFileSync(new URL('../data/levels-12-15.json', import.meta.url)));

assert.equal(validateCampaign(campaign), campaign);
assert.equal(campaign.defaultLevelId, levelOne.id, 'campaign default must preserve the proven Greenhouse Gauntlet');
assert.equal(campaign.levelCount, 15, 'Seed Man Run must expose fifteen total levels');
assert.equal(campaign.newLevelCount, 14, 'campaign must add fourteen levels beyond Greenhouse Gauntlet');
assert.equal(campaign.worlds.length, 5, 'campaign should progress through five themed worlds');

const levels = flattenCampaignLevels(campaign);
assert.equal(levels.length, 15);
assert.deepStrictEqual(levels.map((entry) => entry.order), Array.from({ length: 15 }, (_, index) => index + 1));
assert.ok(levels.every((entry) => entry.status === 'playable'), 'all fifteen levels should be directly playable in this release');
assert.equal(levels[0].id, 'sprout-run');
assert.equal(levels[0].dataPath, 'data/level-01.json');
assert.equal(levels[10].id, 'cloud-nine-citadel');
assert.equal(levels[10].worldId, 'world-04');
assert.equal(levels[11].id, 'chromosome-crossing');
assert.equal(levels[14].id, 'genome-spire');
assert.equal(levels[14].worldId, 'world-05');
assert.equal(levels[14].worldTitle, 'Genetic Frontier');

for (const [pack, expectedCount] of [[corePack, 10], [frontierPack, 4]]) {
  assert.equal(pack.schemaVersion, 2);
  assert.equal(pack.generator, 'seed-man-course-v2');
  assert.equal(pack.campaignId, 'sprout-run-campaign');
  assert.equal(pack.levels.length, expectedCount);
  assert.equal(new Set(pack.levels.map((entry) => entry.setting)).size, expectedCount, 'every generated stage needs a unique setting description');
  assert.equal(new Set(pack.levels.map((entry) => entry.theme)).size, expectedCount, 'every generated stage needs a unique environment theme');
}
assert.equal(corePack.levels.filter((entry) => entry.boss).length, 4, 'the original four worlds retain their boss encounters');
assert.equal(frontierPack.levels.filter((entry) => entry.boss).length, 2, 'Genetic Frontier must contain a midpoint and final boss');
assert.deepStrictEqual(
  [...corePack.levels, ...frontierPack.levels].filter((entry) => entry.boss).map((entry) => entry.boss.name),
  ['The Phantom Pump', 'Mite Queen', 'Mildew Wraith', 'Pollen Warden', 'Voltage Wasp Alpha', 'Genome Hydra']
);

const generatedCore = generateCoursePack(corePack);
const generatedFrontier = generateCoursePack(frontierPack);
const generated = [...generatedCore, ...generatedFrontier];
assert.equal(generated.length, 14, 'course generator must materialize all generated campaign stages');
assert.deepStrictEqual(generated.map((entry) => entry.id), levels.slice(1).map((entry) => entry.id), 'generated level order must match the campaign manifest');

let previousDifficulty = 0;
const seenMechanics = new Set();
let generatedBosses = 0;
for (const [index, generatedLevel] of generated.entries()) {
  const manifest = levels[index + 1];
  const template = index < corePack.levels.length ? corePack.levels[index] : frontierPack.levels[index - corePack.levels.length];
  assert.equal(generatedLevel.schemaVersion, 3, `${generatedLevel.id} must use the expanded level schema`);
  assert.equal(generatedLevel.levelNumber, index + 2, `${generatedLevel.id} has the wrong level number`);
  assert.equal(manifest.dataKey, generatedLevel.id, `${generatedLevel.id} manifest dataKey mismatch`);
  assert.equal(manifest.dataPath, index < 10 ? 'data/levels-02-11.json' : 'data/levels-12-15.json', `${generatedLevel.id} uses the wrong generated pack`);
  assert.ok(generatedLevel.worldWidth >= 4200 && generatedLevel.worldWidth <= 6800, `${generatedLevel.id} world width is outside the campaign budget`);
  assert.equal(generatedLevel.worldHeight, 540, `${generatedLevel.id} must preserve the established viewport physics height`);
  assert.equal(generatedLevel.pickups.length, generatedLevel.requiredPickups, `${generatedLevel.id} pickup gate mismatch`);
  assert.ok(generatedLevel.platforms.length >= 12, `${generatedLevel.id} needs enough geometry to be a full stage`);
  assert.ok(generatedLevel.hazards.length >= 8, `${generatedLevel.id} needs a meaningful hazard layout`);
  assert.ok(generatedLevel.powerups.length >= 3, `${generatedLevel.id} needs power-up routing choices`);
  assert.ok(generatedLevel.checkpoints.length >= 2, `${generatedLevel.id} needs recovery checkpoints`);
  assert.ok(generatedLevel.mechanicZones.length >= 3, `${generatedLevel.id} needs repeated signature-mechanic encounters`);
  assert.equal(generatedLevel.mechanicZones[0].type, template.mechanic.type);
  seenMechanics.add(generatedLevel.mechanicZones[0].type);
  assert.ok(generatedLevel.palette?.sky && generatedLevel.palette?.ground && generatedLevel.palette?.accent, `${generatedLevel.id} needs a complete environment palette`);
  assert.ok(generatedLevel.setting.length >= 30, `${generatedLevel.id} needs a meaningful setting description`);
  assert.ok(generatedLevel.finish.x > generatedLevel.worldWidth * 0.75 && generatedLevel.finish.x < generatedLevel.worldWidth, `${generatedLevel.id} finish gate must be late in the course`);
  assert.ok(generatedLevel.spawn.x >= 0 && generatedLevel.spawn.x < generatedLevel.worldWidth, `${generatedLevel.id} spawn must stay in bounds`);
  assert.ok(generatedLevel.difficulty >= previousDifficulty, `${generatedLevel.id} difficulty must not regress`);
  previousDifficulty = generatedLevel.difficulty;

  if (template.boss) {
    generatedBosses += 1;
    assert.ok(generatedLevel.boss, `${generatedLevel.id} must materialize its boss`);
    assert.equal(generatedLevel.boss.name, template.boss.name);
    assert.ok(generatedLevel.boss.requiredHits >= 3 && generatedLevel.boss.requiredHits <= 5);
    assert.ok(generatedLevel.boss.x >= generatedLevel.boss.arenaStartX);
    assert.ok(generatedLevel.boss.x + generatedLevel.boss.width <= generatedLevel.boss.arenaEndX + 1);
    assert.ok(generatedLevel.boss.arenaEndX < generatedLevel.finish.x, `${generatedLevel.id} boss should resolve before the finish flag`);
  } else {
    assert.equal(generatedLevel.boss, null);
  }

  for (const collection of [generatedLevel.pickups, generatedLevel.powerups, generatedLevel.checkpoints, generatedLevel.mechanicZones]) {
    const ids = collection.map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length, `${generatedLevel.id} generated duplicate ids`);
  }

  for (const rectangle of [...generatedLevel.platforms, ...generatedLevel.hazards, ...generatedLevel.pickups, ...generatedLevel.powerups, ...generatedLevel.checkpoints, ...generatedLevel.mechanicZones, generatedLevel.finish]) {
    assert.ok(Number.isFinite(rectangle.x) && Number.isFinite(rectangle.y), `${generatedLevel.id} contains non-finite coordinates`);
    assert.ok(rectangle.width > 0 && rectangle.height > 0, `${generatedLevel.id} contains invalid rectangle dimensions`);
    assert.ok(rectangle.x >= 0 && rectangle.x + rectangle.width <= generatedLevel.worldWidth + 1, `${generatedLevel.id} contains out-of-bounds geometry`);
  }

  const ground = generatedLevel.platforms.filter((platform) => platform.y === 480 && platform.height === 60).sort((a, b) => a.x - b.x);
  for (let groundIndex = 1; groundIndex < ground.length; groundIndex += 1) {
    const gap = ground[groundIndex].x - (ground[groundIndex - 1].x + ground[groundIndex - 1].width);
    assert.ok(gap >= 0 && gap <= 160, `${generatedLevel.id} generated an unsafe horizontal gap of ${gap}px`);
  }
}
assert.equal(generatedBosses, 6);
assert.ok(seenMechanics.size >= 9, 'expanded campaign must preserve broad traversal variety');

const state = createCampaignState(campaign);
assert.deepStrictEqual(state, {
  campaignId: 'sprout-run-campaign',
  activeLevelId: 'sprout-run',
  worldId: 'world-01',
  levelOrder: 1,
  worldOrder: 1
});

const finalState = createCampaignState(campaign, 'genome-spire');
assert.equal(finalState.levelOrder, 15);
assert.equal(finalState.worldId, 'world-05');
assert.equal(finalState.worldOrder, 5);
assert.throws(() => createCampaignState(campaign, 'missing-level'), /unknown campaign level/);

const duplicate = structuredClone(campaign);
duplicate.worlds[0].levels.push({ ...duplicate.worlds[0].levels[0] });
assert.throws(() => validateCampaign(duplicate), /duplicate campaign level/);

const locked = structuredClone(campaign);
locked.worlds[4].levels[3].status = 'locked';
assert.throws(() => createCampaignState(locked, 'genome-spire'), /not playable/);

console.log('Seed Man fifteen-level settings, mechanics, bosses, and geometry tests passed');
