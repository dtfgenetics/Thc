import assert from 'node:assert/strict';
import { actionForCode,INPUT_ACTIONS } from '../src/systems/input-actions.mjs';
assert.deepEqual(INPUT_ACTIONS,['move-left','move-right','jump','attack','phenotype','pause']);
assert.equal(actionForCode('KeyA'),'move-left');assert.equal(actionForCode('KeyJ'),'attack');assert.equal(actionForCode('KeyK'),'phenotype');assert.equal(actionForCode('Nope'),null);
console.log('Seed Man input actions OK');
