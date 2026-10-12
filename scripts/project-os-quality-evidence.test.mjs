import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CATEGORIES, evaluateEvidence} from './project-os-quality-evidence.mjs';
const sha='a'.repeat(40);
const date='2026-10-11T10:00:00Z';
const project=[{id:'app',repo:'dtfgenetics/Thc'}];
const apps=[{id:'app',repository:'dtfgenetics/Thc',route:'/app/'}];
const proof=()=>({status:'pass',url:'https://github.com/dtfgenetics/Thc/actions/runs/123',commitSha:sha,verifiedAt:date});
const evidence=()=>[{appId:'app',repository:'dtfgenetics/Thc',commitSha:sha,categories:Object.fromEntries(CATEGORIES.map(c=>[c,proof()]))}];
const evaluate=(entries=evidence(),p=project,a=apps)=>evaluateEvidence(p,a,entries,{now:'2026-10-11T11:00:00Z'});
test('six self-reported claims cannot certify readiness',()=>{
  const report=evaluate();
  assert.equal(report.readyApps,0);
  assert.equal(report.totalApps,1);
  assert.deepEqual(report.errors,[]);
  assert.equal(report.results[0].categories.build.reason,'unattested evidence claim; independent verification required');
});
test('absence of evidence never counts as passing',()=>{
  const report=evaluate([]);
  assert.equal(report.readyApps,0);
  assert(CATEGORIES.every(c=>report.results[0].categories[c].status==='unknown'));
});
test('every evidence category independently blocks readiness',()=>{
  for(const category of CATEGORIES){
    const rows=evidence();
    delete rows[0].categories[category];
    const report=evaluate(rows);
    assert.equal(report.readyApps,0,category);
    assert.equal(report.results[0].categories[category].status,'unknown');
  }
});
test('rejects stale, future, invalid URL, and mismatched SHA evidence',()=>{
  for(const mutate of [
    p=>{p.verifiedAt='2026-08-01T00:00:00Z';},
    p=>{p.verifiedAt='2026-12-01T00:00:00Z';},
    p=>{p.url='http://example.com';},
    p=>{p.commitSha='b'.repeat(40);},
    p=>{p.status='not-a-status';}
  ]){
    const rows=evidence();
    mutate(rows[0].categories.security);
    assert.equal(evaluate(rows).readyApps,0);
  }
});
test('detects unknown apps and duplicate evidence',()=>{
  const duplicate=[...evidence(),...evidence(),{appId:'unregistered'}];
  const report=evaluate(duplicate);
  assert.equal(report.readyApps,0);
  assert.equal(report.errors.length,2);
});
test('rejects registry owner conflict',()=>{
  const report=evaluate(evidence(),[{id:'app',repo:'dtfgenetics/Other'}]);
  assert.equal(report.readyApps,0);
  assert(report.errors.some(e=>e.includes('ownership disagreement')));
});
test('gives every deployed application its own evidence result',()=>{
  const report=evaluate(evidence(),project,[...apps,{id:'second',repository:'dtfgenetics/Tools'}]);
  assert.equal(report.totalApps,2);
  assert.equal(report.readyApps,0);
  assert.equal(report.results[1].categories.production.status,'unknown');
});

test('unregistered project owner cannot pass even with six passing evidence claims',()=>{
  const report=evaluate(evidence(),[]);
  assert.equal(report.readyApps,0);
  assert.equal(report.results[0].projectRegistered,false);
  assert.equal(report.results[0].ownerMatch,null);
});
