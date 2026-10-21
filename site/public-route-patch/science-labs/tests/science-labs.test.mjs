import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=name=>readFileSync(path.join(root,name),'utf8');
const html=file('index.html');
const deep=file('science-deep-dive.js');
const quantitative=file('quantitative-labs.js');
const evidence=JSON.parse(file('evidence.json'));
const es=t=>0.6108*Math.exp(17.27*t/(t+237.3));
test('all ten labs are declared and linked to a single navigation entrypoint',()=>{
const ids=['anatomy','rhizosphere','diagnostics','vpd','trichomes','lifecycle','genetics','lighting','transport','academy'];
for(const id of ids)assert.match(html,new RegExp('\\["'+id+'","'));
assert.match(html,/CustomEvent\('thc:lab-change'/);
assert.match(deep,/addEventListener\('thc:lab-change'/);
assert.match(quantitative,/addEventListener\('thc:lab-change'/);
assert.match(html,/science-deep-dive\.js/);
assert.match(html,/quantitative-labs\.js/);
});
test('no legacy competing navigation patch is retained',()=>{
assert.doesNotMatch(deep,/window\.show\s*=/);
assert.doesNotMatch(quantitative,/querySelectorAll\('#navigation button'\)/);
});
test('leaf VPD example and limiting cases',()=>{
const leafVpd=(air,rh,leaf)=>es(leaf)-es(air)*rh/100;
assert.ok(Math.abs(leafVpd(26,60,24)-0.96705358)<1e-6);
assert.ok(Math.abs(leafVpd(25,100,25))<1e-12);
assert.ok(leafVpd(26,100,20)<0); // dew/condensation risk
});
test('bounded sensor uncertainty encloses nominal leaf VPD for input tolerances',()=>{
const air=26,rh=60,offset=-2,t=0.5,h=3,k=1;
const lo=es(air-t+offset-k)-es(air+t)*Math.min(100,rh+h)/100;
const hi=es(air+t+offset+k)-es(air-t)*Math.max(0,rh-h)/100;
const nominal=es(air+offset)-es(air)*rh/100;
assert.ok(lo<nominal&&nominal<hi);
});
test('daily light integral and allele frequencies',()=>{
assert.equal(500*12*3600/1e6,21.6);
for(const [p,q] of [[.5,.5],[0,0],[1,1],[.35,.8]]){
const aa=p*q,hetero=p*(1-q)+(1-p)*q,recessive=(1-p)*(1-q);
assert.ok(Math.abs(aa+hetero+recessive-1)<1e-12);
}
});
test('differential diagnosis exercise is wired and avoids pseudo-probabilities',()=>{
const script=file('diagnostic-lab.js');
assert.ok(html.includes('diagnostic-lab.js'));
assert.match(script,/thc:lab-change/);
assert.match(script,/Matching teaching cues|matching teaching cues/i);
assert.match(script,/not statistical probabilities/);
assert.match(script,/Verification:/);
assert.match(script,/aria-pressed/);
});
test('evidence registry includes explicit uncertainty boundaries',()=>{
assert.ok(evidence.sources.length>=3);
assert.ok(evidence.editorialRules.some(x=>/rhizophagy/i.test(x)));
assert.ok(evidence.editorialRules.some(x=>/certification/i.test(x)));
});

test('PPFD survey must reject missing samples instead of silently treating them as zero',()=>{
assert.match(quantitative,/x\.value\.trim\(\)===''\?NaN:Number\(x\.value\)/);
assert.match(quantitative,/blank readings are not zero/);
for(const raw of ['', ' ', '500']){
const parsed=raw.trim()===''?NaN:Number(raw);
assert.equal(Number.isFinite(parsed),raw==='500');
}
});

test('anatomy learning module links to the published canonical interactive explorer',()=>{
assert.match(html,/\["anatomy","Plant anatomy"[^\n]*"\/atlas\/anatomy-explorer\/"/);
assert.match(html,/\/atlas\/anatomy-explorer\//);
});
