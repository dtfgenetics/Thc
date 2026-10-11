import assert from 'node:assert/strict';
import {test} from 'node:test';
import {summarizeQualityReport} from './project-os-evidence-summary.mjs';
import {CATEGORIES} from './project-os-quality-evidence.mjs';
const cat=(status,reason)=>({status,reason});
test('aggregates six category statuses per application without claiming missing evidence passed',()=>{
 const ok=Object.fromEntries(CATEGORIES.map(c=>[c,cat('pass',null)]));
 const report={evaluatedAt:'2026-10-11T16:00:00Z',errors:[],results:[
   {appId:'a',route:'/a/',ready:true,ownerMatch:true,categories:ok},
   {appId:'b',route:'/b/',ready:false,ownerMatch:null,categories:{source:cat('pass',null),build:cat('fail','test failed')}}
 ]};
 const out=summarizeQualityReport(report);
 assert.equal(out.totalApps,2);assert.equal(out.readyApps,1);assert.equal(out.blockedApps,1);
 assert.equal(out.categories.build.fail,1);
 assert.equal(out.categories.production.unknown,1);
 assert.equal(out.blockers[0].missing.length,5);
});
test('owner mismatch becomes actionable source blocker',()=>{
 const report={results:[{appId:'x',ownerMatch:false,ready:false,categories:Object.fromEntries(CATEGORIES.map(c=>[c,cat('pass',null)]))}]};
 assert(summarizeQualityReport(report).blockers[0].missing.some(x=>x.reason==='registry owner conflict'));
});
test('rejects structurally missing report results',()=>assert.throws(()=>summarizeQualityReport({}),TypeError));

test('missing registered owner is an actionable blocker even with six passes',()=>{
 const report={results:[{appId:'unowned',ownerMatch:null,ready:false,categories:Object.fromEntries(CATEGORIES.map(c=>[c,cat('pass',null)]))}]};
 const summary=summarizeQualityReport(report);
 assert.equal(summary.blockedApps,1);
 assert(summary.blockers[0].missing.some(item=>item.reason==='no matching registered project owner'));
});
