import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {probePublicRoutes} from './project-os-production-smoke.mjs';
const routes=[{path:'/tools/',marker:'Grow with records.'}];
const response=(html,status=200,type='text/html')=>({ok:status>=200&&status<300,status,headers:{get:()=>type},text:async()=>html});
test('accepts expected HTML on fixed HTTPS production host',async()=>{
 const result=await probePublicRoutes({routes,fetchImpl:async(url,options)=>{assert.equal(url.href,'https://dtfseeds.com/tools/');assert.equal(options.redirect,'manual');return response('<h1>Grow with records.</h1>');}});
 assert.equal(result.passing,1);
 assert.match(result.scope,/not proof of artifact provenance/);
});
test('rejects missing content and non-200 responses',async()=>{
 for(const item of [response('<h1>other</h1>'),response('GrowLens',404),response('GrowLens',200,'application/json'),response('',302)]){
  const result=await probePublicRoutes({routes,fetchImpl:async()=>item});assert.equal(result.passing,0);
 }
});
test('does not allow arbitrary host or injected route',async()=>{
 await assert.rejects(()=>probePublicRoutes({base:'https://example.org',routes:[]}),/Unsupported/);
 await assert.rejects(()=>probePublicRoutes({routes:[{path:'//evil.com/',marker:'bad'}]}),/Invalid smoke route/);
});
test('network failures are blocked without claiming live status',async()=>{
 const result=await probePublicRoutes({routes,fetchImpl:async()=>{throw Error('offline');}});
 assert.equal(result.passing,0);assert.equal(result.results[0].reason,'request failure');
});

test('shared footer text cannot masquerade as a route-specific page',async()=>{
 const html='<main><h1>Wrong page</h1></main><footer>Grow with records.</footer>';
 const result=await probePublicRoutes({routes,fetchImpl:async()=>response(html)});
 assert.equal(result.passing,0);
});

test('deployment SHA is an unauthenticated observation, never automatic release approval',async()=>{
 const sha='a'.repeat(40);
 const fetchImpl=async()=>({ok:true,status:200,headers:{get:key=>key==='content-type'?'text/html':key==='x-dtf-deployment-sha'?sha:null},text:async()=>'<h1>Grow with records.</h1>'});
 const report=await probePublicRoutes({routes,fetchImpl,expectedDeploymentSha:sha});
 assert.equal(report.results[0].deploymentIdentity,'header-matches-expected');
 assert.equal(report.results[0].observedDeploymentSha,sha);
 assert.match(report.scope,/not proof of artifact provenance/);
});
test('missing or mismatched deployment headers remain visible without false attestation',async()=>{
 const sha='a'.repeat(40);
 for(const header of [null,'b'.repeat(40),'not-a-hash']){
  const report=await probePublicRoutes({routes,expectedDeploymentSha:sha,fetchImpl:async()=>({ok:true,status:200,headers:{get:key=>key==='content-type'?'text/html':header},text:async()=>'<h1>Grow with records.</h1>'})});
  assert.notEqual(report.results[0].deploymentIdentity,'header-matches-expected');
 }
 await assert.rejects(()=>probePublicRoutes({routes:[],expectedDeploymentSha:'oops'}),/Invalid expected deployment SHA/);
});

test('CLI rejects malformed expected deployment SHA before network requests',()=>{
 const run=spawnSync(process.execPath,['scripts/project-os-production-smoke.mjs'],{encoding:'utf8',env:{...process.env,PROJECT_OS_EXPECTED_DEPLOYMENT_SHA:'not-a-sha'}});
 assert.notEqual(run.status,0);
 assert.match(run.stderr,/Invalid expected deployment SHA/);
});
