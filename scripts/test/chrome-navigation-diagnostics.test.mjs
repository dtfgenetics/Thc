import test from 'node:test';
import assert from 'node:assert/strict';
import {safeNavigationEvent} from '../diagnose-chrome-navigation.mjs';

test('real Chrome document response keeps status and safe headers only',()=>{
 const result=safeNavigationEvent({method:'Network.responseReceived',params:{
   type:'Document',
   response:{
     url:'https://dtfseeds.com/atlas/anatomy-explorer/?token=SECRET#private',
     status:403,
     headers:{
       'Content-Type':'text/html',
       'Server':'hcdn',
       'X-Request-ID':'request-123',
       'Set-Cookie':'secret-session',
       'Location':'https://other.example/?token=secret',
       'Authorization':'secret-token'
     }
   }
 }});
 assert.deepEqual(result,{
   path:'/atlas/anatomy-explorer/',status:403,
   headers:{'content-type':'text/html',server:'hcdn','x-request-id':'request-123'}
 });
 assert.ok(!JSON.stringify(result).includes('SECRET'));
 assert.ok(!JSON.stringify(result).includes('secret'));
});

test('subresources, offsite documents and other messages do not leak into report',()=>{
 const data={method:'Network.responseReceived',params:{type:'Script',response:{url:'https://dtfseeds.com/a.js',status:200}}};
 assert.equal(safeNavigationEvent(data),null);
 data.params.type='Document';
 data.params.response.url='https://outside.example/checkout';
 assert.equal(safeNavigationEvent(data),null);
 assert.equal(safeNavigationEvent({method:'Page.loadEventFired'}),null);
});
