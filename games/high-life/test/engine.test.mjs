import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ACTIONS, ERA_LENGTH, MAX_TURNS, calculateLegacyScore, createGame, currentEra, legalActions, playStrategy, takeTurn } from '../src/engine.mjs';

const events = JSON.parse(fs.readFileSync(new URL('../data/events.json', import.meta.url)));

assert.equal(Object.keys(ACTIONS).length, 6);
assert.equal(events.length, 18);
assert.equal(new Set(events.map((event) => event.id)).size, events.length);

const sequence = ['learn', 'network', 'genetics', 'document', 'build', 'brand'];
const runA = playStrategy({ seed: 420, actions: sequence, events });
const runB = playStrategy({ seed: 420, actions: sequence, events });
assert.deepEqual(runA, runB, 'same seed and choices must be deterministic');
assert.equal(runA.turn, MAX_TURNS);
assert.equal(runA.complete, true);
assert.equal(runA.history.length, MAX_TURNS);
assert.equal(runA.milestones.length, 2);
assert.equal(runA.finalScore, calculateLegacyScore(runA));
assert.ok(Number.isFinite(runA.finalScore) && runA.finalScore > 0);

let state = createGame({ seed: 7 });
assert.equal(currentEra(state), 'underground');
assert.equal(legalActions(state).find((a) => a.id === 'brand').allowed, false);
for (let i = 0; i < ERA_LENGTH; i += 1) state = takeTurn(state, i % 2 ? 'network' : 'learn', events);
assert.equal(currentEra(state), 'medical');
assert.equal(state.milestones.length, 1);
assert.equal(legalActions(state).find((a) => a.id === 'brand').allowed, true);

state.resources.cash = 0;
assert.equal(legalActions(state).find((a) => a.id === 'build').allowed, false);
assert.throws(() => takeTurn(state, 'build', events), /Not enough/);

const strategies = {
  knowledge: ['learn', 'document', 'network', 'genetics'],
  builder: ['build', 'network', 'learn', 'brand'],
  genetics: ['genetics', 'network', 'learn', 'document'],
  balanced: ['network', 'learn', 'genetics', 'build', 'document', 'brand']
};
const averages = {};
for (const [name, actions] of Object.entries(strategies)) {
  let total = 0;
  for (let seed = 1; seed <= 120; seed += 1) total += playStrategy({ seed, actions, events }).finalScore;
  averages[name] = total / 120;
}
const values = Object.values(averages);
const spread = Math.max(...values) - Math.min(...values);
assert.ok(spread <= 38, `strategy score spread too large: ${JSON.stringify(averages)}`);
console.log('High Life engine validation passed', { averages, spread });
