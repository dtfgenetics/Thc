import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateObservation } from '../docs/education/diagnostics/observation-validation.mjs';
const spec=JSON.parse(readFileSync(new URL('../docs/education/diagnostics/root-zone-observation-template.json',import.meta.url),'utf8'));
const valid={recordedAt:'2026-10-11T14:15',medium:'soil',containerLiters:'11',soilPH:'7.4',method:'soil extract',sampleLocation:'root zone'};
const good=validateObservation(valid,spec);
assert.equal(good.ok,true,good.errors.join('; '));
assert.equal(good.record.containerLiters,11);
assert.equal(good.record.soilPH,7.4);
assert.equal(good.record.soilEC,null);
const missing=validateObservation({...valid,method:''},spec);
assert.equal(missing.ok,false);
assert(missing.errors.some(e=>e.includes('method')));
for (const changes of [{soilPH:'15'},{soilEC:'not a number'},{containerLiters:'-1'},{recordedAt:'invalid'}, {medium:'invalid'}, {recordedAt:''}]){
 const result=validateObservation({...valid,...changes},spec);
 assert.equal(result.ok,false,JSON.stringify(changes));
}
const unknown=validateObservation({recordedAt:'2026-10-11T14:15',medium:'soil',containerLiters:'11'},spec);
assert.equal(unknown.ok,true);
assert.equal(unknown.record.soilPH,null);
assert.equal(unknown.record.soilEC,null);
assert.equal(unknown.record.method,null);
console.log('Observation intake validation tests passed');
