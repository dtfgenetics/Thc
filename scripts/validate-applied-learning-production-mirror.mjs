import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root='site/public-route-patch/applied-learning';
const data=JSON.parse(fs.readFileSync(`${root}/data.json`,'utf8'));
const html=fs.readFileSync(`${root}/index.html`,'utf8');
const js=fs.readFileSync(`${root}/app.js`,'utf8');
const revision=Object.fromEntries(fs.readFileSync(`${root}/source-revision.txt`,'utf8').trim().split(/\n+/).map(line=>line.split('=',2)));

const target=JSON.parse(fs.readFileSync('site/wordpress/education/academy-deployment-target.json','utf8'));
assert.equal(data.schemaVersion,1);
assert.equal(data.sourceRepository,'dtfgenetics/Thc-learning-courses-');
assert.equal(data.sourceSha,target.sourceSha,'Applied Learning mirror must match Academy deployment target');
assert.equal(revision.repository,data.sourceRepository);
assert.equal(revision.commit,data.sourceSha);
assert.match(js,new RegExp(`const SOURCE_SHA=['"]${data.sourceSha}['"]`),'runtime source pin must match exported data');
assert.match(html,/<script\b[^>]*type="module"[^>]*src="\.\/app\.js"[^>]*><\/script>/,'top-level await runtime must load as a module');
const syntax=spawnSync(process.execPath,['--input-type=module','--check'],{input:js,encoding:'utf8'});
assert.equal(syntax.status,0,`Applied Learning module syntax: ${syntax.stderr}`);
assert.equal(revision.route,'/applied-learning/');
assert.equal(revision.status,'development-preview');

assert.equal(data.releaseState,'development-preview');
assert.equal(data.graph.status,'draft');
assert.equal(data.measurement.status,'draft');
assert.equal(data.calculator.status,'draft');
assert.equal(data.differential.status,'draft');
assert.equal(data.graph.nodes.length,50);
assert.ok(data.graph.edges.some(edge=>edge.source==='ALNODE-CLAIM-ENV-VPD-001'&&edge.target==='ALNODE-COMP-ENV-VPD-001'));
assert.equal(data.measurement.id,'ALMEAS-SENSOR-PLACEMENT-001');
assert.equal(data.calculator.id,'ALCALC-DLI-001');
assert.equal(data.differential.id,'ALDIFF-YELLOWING-001');
assert.equal(data.differential.hypotheses.length,3);
assert.match(data.differential.boundary,/does not diagnose/i);

for(const forbidden of ['review','instructor','rules','correct','answerKey','scoringKey','rationale']){
  assert.ok(!Object.prototype.hasOwnProperty.call(data.graph,forbidden));
  assert.ok(!Object.prototype.hasOwnProperty.call(data.measurement,forbidden));
  assert.ok(!Object.prototype.hasOwnProperty.call(data.calculator,forbidden));
  assert.ok(!Object.prototype.hasOwnProperty.call(data.differential,forbidden));
}

const dli=500*18*3600/1_000_000;
assert.ok(Math.abs(dli-32.4)<1e-9);
assert.match(html,/Development Preview/);
assert.match(html,/Applied Learning Lab/);
assert.match(html,/Same Symptom, Different Cause/);
assert.match(html,new RegExp(data.sourceSha));
assert.match(js,/fetch\('\.\/data\.json'/);
assert.match(js,/ppfd\*hours\*3600\/1_000_000/);
assert.ok(!js.includes('/api/applied-learning/'),'production mirror must be self-contained');

for(const file of ['index.html','app.js','styles.css','data.json','source-revision.txt']){
  assert.ok(fs.statSync(`${root}/${file}`).size>0,`${file} must be non-empty`);
}
console.log(`Applied Learning production mirror valid at ${data.sourceSha} with ${data.graph.nodes.length} canonical graph nodes.`);
