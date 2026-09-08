import assert from 'node:assert/strict';
import { createPhenotypeState,absorbPhenotype } from '../src/systems/phenotype-system.mjs';
import { buildHudModel } from '../src/systems/hud-model.mjs';
let phenotype=createPhenotypeState();phenotype=absorbPhenotype(phenotype,'electric',1000);
const hud=buildHudModel({health:2,maxHealth:3,energy:80,lives:3,seeds:127,world:5,level:20,phenotypeState:phenotype,nowMs:6000,boss:{id:'blight-king',health:72,maxHealth:96,phase:2,defeated:false}});
assert.equal(hud.phenotype,'electric');assert.equal(hud.phenotypeRemainingMs,25000);assert.equal(hud.boss.id,'blight-king');assert.equal(hud.level,20);assert.equal(hud.seeds,127);
console.log('Seed Man HUD model OK');
