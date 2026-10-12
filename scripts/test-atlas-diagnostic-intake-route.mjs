import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateObservation} from '../site/public-route-patch/atlas/diagnostics/evidence-intake/observation-validation.mjs';
const root=new URL('../site/public-route-patch/atlas/diagnostics/',import.meta.url);
const text=(name)=>readFileSync(new URL(name,root),'utf8');
const html=text('evidence-intake/index.html');
const script=text('evidence-intake/observation-demo.mjs');
const schema=JSON.parse(text('evidence-intake/root-zone-observation-template.json'));
const landing=text('index.html');
assert.match(landing,/href="\/atlas\/diagnostics\/evidence-intake\/"/);
assert.match(html,/<form id="intake"/);
assert.match(html,/name="viewport"/);
assert.match(html,/role="alert"/);
assert.match(html,/aria-live="polite"/);
assert.match(html,/observation-demo\.mjs/);
assert.match(script,/validateObservation/);
assert.match(script,/root-zone-observation-template\.json/);
assert.equal(schema.fields.length,13);
const valid={recordedAt:'2026-10-12T08:30',medium:'soil',containerLiters:'11',soilEC:'1.6',method:'soil slurry',sampleLocation:'root zone'};
assert.equal(validateObservation(valid,schema).ok,true);
assert.equal(validateObservation({...valid,method:''},schema).ok,false);
assert.equal(validateObservation({...valid,soilEC:'-2'},schema).ok,false);
assert.equal(validateObservation({...valid,recordedAt:'2026-02-30T08:30'},schema).ok,false);
assert.equal(validateObservation({...valid,soilEC:''},schema).record.soilEC,null);
for (const file of ['observation-demo.mjs','observation-validation.mjs','root-zone-observation-template.json']){
 const doc=readFileSync(new URL('../docs/education/diagnostics/'+file,import.meta.url),'utf8');
 assert.equal(text('evidence-intake/'+file),doc,'Route asset diverged from canonical source: '+file);
}
console.log('Atlas diagnostic intake static route and validation checks passed');
