import assert from 'node:assert/strict';import { phenotypeDropForEnemy } from '../src/systems/power-drop.mjs';
for(const phenotype of ['fire','electric','ice']){const drop=phenotypeDropForEnemy({phenotype});assert.equal(drop.phenotype,phenotype);assert.equal(drop.durationMs,30000);}assert.equal(phenotypeDropForEnemy({}),null);console.log('Seed Man phenotype drops OK');
