#!/usr/bin/env node
import assert from 'node:assert/strict';
import {computePriorityScore,scoreWorkItem,DEFAULT_WEIGHTS} from './project-os-priority.mjs';

assert.equal(computePriorityScore({severity:5,userImpact:5,productionExposure:5,unblockValue:5,ageDays:2,complexity:1,collisionRisk:0}),99);
assert.equal(computePriorityScore({severity:1,userImpact:1,productionExposure:0,unblockValue:0,ageDays:0,complexity:5,collisionRisk:5}),-29);
assert.ok(computePriorityScore({severity:5,userImpact:5,productionExposure:5,unblockValue:5,ageDays:0,complexity:1,collisionRisk:0}) >
          computePriorityScore({severity:2,userImpact:2,productionExposure:1,unblockValue:1,ageDays:20,complexity:1,collisionRisk:0}));
const original={workItemId:'x',priority:{severity:3,userImpact:4,productionExposure:4,unblockValue:5,ageDays:0,complexity:2,collisionRisk:1}};
const scored=scoreWorkItem(original);
assert.equal(scored.priority.score,67);
assert.equal(original.priority.score,undefined);
assert.throws(()=>computePriorityScore({severity:'bad'}),/must be numeric/);
assert.deepEqual(Object.keys(DEFAULT_WEIGHTS),['severity','userImpact','productionExposure','unblockValue','ageDays','complexity','collisionRisk']);
console.log('Project OS priority scoring tests passed');
