import assert from 'node:assert/strict';
import {test} from 'node:test';
import {classifyRun,collectWorkflowObservations} from './project-os-workflow-observations.mjs';
const sha='a'.repeat(40),repo='dtfgenetics/Thc',now=Date.parse('2026-10-11T16:00:00Z');
const good=()=>({name:'CodeQL Security',head_sha:sha,repository:{full_name:repo},status:'completed',conclusion:'success',event:'pull_request',updated_at:'2026-10-11T15:00:00Z',id:123,run_attempt:1});
test('records successful, exact SHA workflow as observation, not approval',()=>{
 const row=classifyRun(good(),{sha,repository:repo,now});
 assert.equal(row.category,'security');
 assert.match(row.observation,/not attested/);
});
test('rejects failed, stale, unrelated and mismatched workflow runs',()=>{
 for(const mutate of [
   r=>{r.conclusion='failure';},r=>{r.conclusion='skipped';},
   r=>{r.status='in_progress';},r=>{r.head_sha='b'.repeat(40);},
   r=>{r.repository.full_name='evil/repo';},r=>{r.name='Unknown Workflow';},
   r=>{r.updated_at='2026-01-01T00:00:00Z';},
   r=>{r.event='workflow_run';},r=>{r.run_attempt=0;}
 ]){const run=good();mutate(run);assert.equal(classifyRun(run,{sha,repository:repo,now}),null);}
});
test('collects only recognized successful workflow runs',async()=>{
 const fetchImpl=async (url,options)=>{
   assert(url.includes('head_sha='+sha));assert.match(options.headers.Authorization,/Bearer secret/);
   const bad=good();bad.conclusion='failure';
   return {ok:true,json:async()=>({workflow_runs:[good(),bad]})};
 };
 const report=await collectWorkflowObservations({repository:repo,sha,token:'secret',fetchImpl,now});
 assert.equal(report.observations.length,1);
 assert.match(report.interpretation,/observations only/);
});
test('API failures and absent credentials fail closed',async()=>{
 await assert.rejects(()=>collectWorkflowObservations({repository:repo,sha,token:''}),/token/);
 await assert.rejects(()=>collectWorkflowObservations({repository:repo,sha,token:'secret',fetchImpl:async()=>({ok:false,status:403})}),/403/);
});
