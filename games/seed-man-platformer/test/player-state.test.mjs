import assert from 'node:assert/strict';
import { absorbPhenotype } from '../src/systems/phenotype-system.mjs';
import { PLAYER_STATE_VERSION, createPlayerState, normalizePlayerState, applyPlayerDamage, completePlayerLevel, setPlayerMovementState, assertPlayerStateContract } from '../src/systems/player-state.mjs';

let state=createPlayerState();
assert.equal(state.version,PLAYER_STATE_VERSION);
assert.equal(state.phenotypeState.active,'plant');
assert.equal(state.health,3);
assert.equal(state.movementState,'idle');

state={...state,phenotypeState:absorbPhenotype(state.phenotypeState,'fire',1000)};
state=normalizePlayerState(state,2000);
assert.equal(state.phenotypeState.active,'fire');
state=normalizePlayerState(state,31001);
assert.equal(state.phenotypeState.active,'plant','temporary phenotype must expire back to Plant');

state=applyPlayerDamage(state,{damage:1,nowMs:32000});
assert.equal(state.health,2);
assert.equal(state.enemyHits,1);
assert.equal(state.movementState,'hurt');
const protectedState=applyPlayerDamage(state,{damage:1,nowMs:32500});
assert.equal(protectedState.health,2,'invulnerability window must prevent duplicate damage');

state=setPlayerMovementState(state,'run');
assert.equal(state.movementState,'run');
assert.throws(()=>setPlayerMovementState(state,'shield-bounce'),/Unsupported Seed Man movement state/);
state=completePlayerLevel(state);
assert.equal(state.finished,true);
assert.equal(state.movementState,'finish');
assert.doesNotThrow(()=>assertPlayerStateContract(state));

for(const retired of ['speedTimer','jumpTimer','magnetTimer','shieldCharges','collectedPowerups']){
  assert.equal(Object.hasOwn(state,retired),false,`retired state must stay absent: ${retired}`);
}

console.log('Seed Man canonical player-state contract tests passed');
