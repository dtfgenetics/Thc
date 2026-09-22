import assert from 'node:assert/strict';
import { actionForCode,INPUT_ACTIONS,DEFAULT_BINDINGS,GAMEPAD_BINDINGS,GAMEPAD_DEADZONE } from '../src/systems/input-actions.mjs';

assert.deepEqual(INPUT_ACTIONS,['move-left','move-right','jump','attack','phenotype','pause']);
assert.equal(actionForCode('KeyA'),'move-left');
assert.equal(actionForCode('KeyJ'),'attack');
assert.equal(actionForCode('KeyX'),'attack','X should remain a first-class attack alias');
assert.equal(actionForCode('KeyK'),'phenotype');
assert.equal(actionForCode('KeyC'),'phenotype','C should remain a first-class phenotype alias');
assert.equal(actionForCode('Escape'),'pause','Escape should pause the public game as advertised by the input contract');
assert.equal(actionForCode('Nope'),null);
assert.deepEqual(DEFAULT_BINDINGS.attack,['KeyJ','KeyX']);
assert.deepEqual(DEFAULT_BINDINGS.phenotype,['KeyK','KeyC']);
assert.equal(GAMEPAD_DEADZONE,0.22);
assert.deepEqual(GAMEPAD_BINDINGS,{
  moveAxis:0,
  moveLeftButton:14,
  moveRightButton:15,
  jumpButton:0,
  phenotypeButton:1,
  attackButton:2,
  pauseButton:9
});
console.log('Seed Man input actions OK');
