import assert from 'node:assert/strict';
import { PHENOTYPES, createPhenotypeState, absorbPhenotype, updatePhenotype, phenotypeRemainingMs, phenotypeAttack } from '../src/systems/phenotype-system.mjs';

assert.deepEqual(Object.keys(PHENOTYPES),['plant','fire','electric','ice']);
for(const id of ['fire','electric','ice']) assert.equal(PHENOTYPES[id].durationMs,30000);
let state=createPhenotypeState();
assert.equal(state.active,'plant');
state=absorbPhenotype(state,'fire',1000);
assert.equal(state.active,'fire');
assert.equal(phenotypeRemainingMs(state,1000),30000);
assert.equal(phenotypeAttack(state).effect,'burn');
state=updatePhenotype(state,31001);
assert.equal(state.active,'plant');
state=absorbPhenotype(state,'electric',50000);
assert.equal(phenotypeAttack(state).effect,'chain');
state=absorbPhenotype(state,'ice',60000);
assert.equal(phenotypeAttack(state).effect,'freeze');
console.log('Seed Man phenotype system OK');
