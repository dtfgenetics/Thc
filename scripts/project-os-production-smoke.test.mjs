import assert from 'node:assert/strict';
import {test} from 'node:test';
import {probePublicRoutes} from './project-os-production-smoke.mjs';
const routes=[{path:'/tools/',marker:'Grow with records.'}];
const response=(html,status=200,type='text/html')=>({ok:status>=200&&status<300,status,headers:{get:()=>type},text:async()=>html});
test('accepts expected HTML on fixed HTTPS production host',async()=>{
 const result=await probePublicRoutes({routes,fetchImpl:async(url,options)=>{assert.equal(url.href,'https://dtfseeds.com/tools/');assert.equal(options.redirect,'manual');return response('<h1>Grow with records.</h1>');}});
 assert.equal(result.passing,1);
 assert.match(result.scope,/no source SHA/);
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
