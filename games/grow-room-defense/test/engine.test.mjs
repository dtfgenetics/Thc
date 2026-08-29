import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MAX_ROUNDS,
  activeThreats,
  applyAction,
  bestToolsForThreat,
  counterQuality,
  createGame,
  isValidDefenseCode,
  normalizeDefenseCode
} from '../src/engine.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../data/ipm.json', import.meta.url), 'utf8'));
const threatById = new Map(data.threats.map((threat) => [threat.id, threat]));
const toolById = new Map(data.tools.map((tool) => [tool.id, tool]));

assert.equal(normalizeDefenseCode('gr-d8 42'), 'GRD842');
assert.equal(isValidDefenseCode('GRD84'), false);
assert.equal(isValidDefenseCode('GRD842'), true);

const aphids = threatById.get('aphid-colony');
assert.equal(counterQuality(aphids, toolById.get('beneficials')), 'strong');
assert.equal(counterQuality(aphids, toolById.get('inspect')), 'supportive');
assert.equal(counterQuality(aphids, toolById.get('airflow')), 'mismatch');

const first = createGame({ code: 'GRD842' }, data);
const repeated = createGame({ code: 'grd842' }, data);
assert.deepEqual(first.lastSpawn, repeated.lastSpawn, 'Same code must reproduce the same first threat and lane.');
assert.equal(activeThreats(first).length, 1);
assert.equal(first.lanes.reduce((sum, lane) => sum + lane.health, 0), 300);

const strongChoice = bestToolsForThreat(first.lastSpawn.threatId, data).find((choice) => choice.quality === 'strong');
assert.ok(strongChoice, 'Every threat should have a strong counter.');
const beforeStrong = structuredClone(first);
const afterStrong = applyAction(first, { toolId: strongChoice.toolId, laneId: first.lastSpawn.laneId }, data);
assert.deepEqual(first, beforeStrong, 'applyAction must not mutate its input state.');
assert.equal(afterStrong.lastAction.quality, 'strong');
assert.equal(afterStrong.lastAction.resolvedThreat, first.lastSpawn.threatId);
assert.equal(afterStrong.totalDamage, 0, 'A strong fresh counter should prevent damage.');
assert.equal(afterStrong.resolved, 1);
assert.equal(afterStrong.round, 2);

const supportiveChoice = bestToolsForThreat(first.lastSpawn.threatId, data).find((choice) => choice.quality === 'supportive');
assert.ok(supportiveChoice, 'Every threat should expose at least one supportive counter.');
const afterSupportive = applyAction(first, { toolId: supportiveChoice.toolId, laneId: first.lastSpawn.laneId }, data);
assert.equal(afterSupportive.lastAction.quality, 'supportive');
assert.ok(afterSupportive.lastAction.reduction > 0);
assert.ok(afterSupportive.totalDamage > 0, 'Supportive counterplay should leave some fresh pressure when it does not fully resolve the threat.');

const mismatchTool = data.tools.find((tool) => counterQuality(threatById.get(first.lastSpawn.threatId), tool) === 'mismatch');
assert.ok(mismatchTool);
const afterMismatch = applyAction(first, { toolId: mismatchTool.id, laneId: first.lastSpawn.laneId }, data);
assert.equal(afterMismatch.lastAction.quality, 'mismatch');
assert.equal(afterMismatch.lastAction.reduction, 0);
assert.ok(afterMismatch.totalDamage > 0);

let perfect = createGame({ code: 'PER842' }, data);
while (perfect.status === 'playing') {
  const spawn = perfect.lastSpawn;
  const choice = bestToolsForThreat(spawn.threatId, data).find((candidate) => candidate.quality === 'strong');
  assert.ok(choice);
  perfect = applyAction(perfect, { toolId: choice.toolId, laneId: spawn.laneId }, data);
}
assert.equal(perfect.status, 'won');
assert.equal(perfect.resolved, MAX_ROUNDS);
assert.equal(perfect.totalDamage, 0);
assert.deepEqual(perfect.lanes.map((lane) => lane.health), [100, 100, 100]);
assert.ok(perfect.score > 300);

let doomed = createGame({ code: 'LOS842' }, data);
const activeId = doomed.lastSpawn.threatId;
const activeDef = threatById.get(activeId);
for (const lane of doomed.lanes) {
  lane.health = 1;
  lane.threats = [{
    instanceId: `forced-${lane.id}`,
    threatId: activeId,
    pressure: activeDef.pressure,
    maxPressure: activeDef.pressure,
    spawnedRound: doomed.round
  }];
}
const doomedMismatch = data.tools.find((tool) => counterQuality(activeDef, tool) === 'mismatch');
doomed = applyAction(doomed, { toolId: doomedMismatch.id, laneId: doomed.lanes[0].id }, data);
assert.equal(doomed.status, 'lost');
assert.equal(doomed.lanes.reduce((sum, lane) => sum + lane.health, 0), 0);

console.log('Grow Room Defense deterministic engine tests passed.');
