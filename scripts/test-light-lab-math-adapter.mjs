import assert from 'node:assert/strict';
import {calculateStableLight,calculateVariableLight,dliRangeForMap} from '../site/public-route-patch/assets/thc-light-lab-math-v1.mjs';

const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const stable=calculateStableLight({ppfd:700,hours:12,targetDli:30.24});
near(stable.dli,30.24);near(stable.requiredPpfd,700);
const variable=calculateVariableLight([{ppfd:300,hours:1},{ppfd:700,hours:10},{ppfd:300,hours:1}]);
near(variable.dli,27.36);near(variable.hours,12);assert.equal(variable.segments.length,3);
const range=dliRangeForMap([500,700,900],12);near(range.min,21.6);near(range.max,38.88);
assert.equal(dliRangeForMap([],12),null);
console.log('Light Lab math adapter passed.');
