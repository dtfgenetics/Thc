import test from 'node:test';
import assert from 'node:assert/strict';
import {collectAccessDiagnostics,publicHeaders} from '../diagnose-lighthouse-access.mjs';

test('diagnostics return only allowlisted response headers and numeric status',async()=>{
 const seen=[];
 const fetchImpl=async (url,options)=>{
   seen.push({url,options});
   return {
     status:403,
     headers:new Headers({
       'content-type':'text/html',
       'server':'edge-security',
       'cf-mitigated':'challenge',
       'set-cookie':'session=secret',
       'authorization':'Bearer secret',
       'location':'https://example.org/?token=secret'
     }),
     body:{async cancel(){}}
   };
 };
 const data=await collectAccessDiagnostics('https://dtfseeds.com/',fetchImpl);
 assert.equal(data.route,'/');
 assert.equal(data.probes.length,2);
 assert.ok(data.probes.every(p=>p.status===403&&p.headers['cf-mitigated']==='challenge'));
 assert.ok(data.probes.every(p=>!JSON.stringify(p).includes('secret')));
 assert.ok(seen.every(p=>p.options.redirect==='manual'));
 assert.notEqual(seen[0].options.headers['user-agent'],seen[1].options.headers['user-agent']);
});

test('header sanitizer strips control characters and rejects sensitive keys',()=>{
 const headers=new Headers({'cf-ray':'abc123','set-cookie':'private','x-request-id':'req-456'});
 const result=publicHeaders(headers);
 assert.deepEqual(result,{'cf-ray':'abc123','x-request-id':'req-456'});
});

test('network failures remain diagnostic and do not masquerade as HTTP 200',async()=>{
 const data=await collectAccessDiagnostics('https://dtfseeds.com/',async()=>{throw Object.assign(new Error('secret URL'),{name:'TimeoutError'});});
 assert.ok(data.probes.every(p=>p.status===0&&p.errorName==='TimeoutError'));
 assert.ok(!JSON.stringify(data).includes('secret URL'));
});
