import assert from 'node:assert/strict';
import fs from 'node:fs';

const campaign = JSON.parse(fs.readFileSync(new URL('../data/campaign-20-v1.json', import.meta.url), 'utf8'));
const levels = campaign.worlds.flatMap((world) => world.levels.map((level) => ({ ...level, worldId: world.id })));

assert.equal(campaign.levelCount, 20);
assert.equal(campaign.worlds.length, 5);
assert.equal(levels.length, 20);
assert.deepEqual(levels.map((level) => level.order), Array.from({ length: 20 }, (_, index) => index + 1));
assert.equal(levels.at(-1).id, '5-4-the-last-seed');
assert.equal(levels.at(-1).type, 'final-boss');
assert.equal(levels.at(-1).boss, 'blight-king');
assert.equal(levels.at(-1).phases, 4);
assert.equal(campaign.finalBoss, 'blight-king');
for (const world of campaign.worlds) assert.equal(world.levels.length, 4, `${world.id} must have four levels`);
console.log('Seed Man 20-level campaign contract OK');
