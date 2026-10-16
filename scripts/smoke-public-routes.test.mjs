import test from 'node:test';
import assert from 'node:assert/strict';
import {probe,validateTargets} from './smoke-public-routes.mjs';
const target=[{name:'homepage',url:'https://dtfseeds.com/',mustContain:'DTF'}];
test('rejects third-party targets',()=>assert.match(validateTargets([{name:'bad',url:'https://example.com/'}]).join(' '),/dtfseeds/));
test('reports successful content check',async()=>{
 const result=await probe(target,async()=>({ok:true,status:200,text:async()=>'<title>DTF</title>'}));
 assert.equal(result[0].ok,true);
});
test('HTTP 200 without expected content fails',async()=>{
 const result=await probe(target,async()=>({ok:true,status:200,text:async()=>'<html>maintenance</html>'}));
 assert.equal(result[0].ok,false);
});
test('server error fails',async()=>{
 const result=await probe(target,async()=>({ok:false,status:503,text:async()=>''}));
 assert.equal(result[0].ok,false);
});
test('network failure fails',async()=>{
 const result=await probe(target,async()=>{throw Error('offline')});
 assert.equal(result[0].ok,false);
});
