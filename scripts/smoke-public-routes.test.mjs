import test from 'node:test';
import assert from 'node:assert/strict';
import {probe,validateTargets} from './smoke-public-routes.mjs';
const target=[{name:'homepage',url:'https://dtfseeds.com/',mustContain:'DTF'}];
test('rejects third-party targets',()=>assert.match(validateTargets([{name:'bad',url:'https://example.com/'}]).join(' '),/dtfseeds/));
test('reports successful content check',async()=>{
 const result=await probe(target,async()=>({ok:true,status:200,url:target[0].url,headers:{get:()=> 'text/html'},text:async()=>'<title>DTF</title>'}));
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

test('rejects an off-site redirect even when response has matching content',async()=>{
 const result=await probe(target,async()=>({ok:true,status:200,url:'https://unrelated.example/',headers:{get:()=> 'text/html'},text:async()=>'<title>DTF</title>'}));
 assert.equal(result[0].ok,false);
 assert.equal(result[0].reason,'unexpected redirect destination');
});
test('rejects a JSON response masquerading as a healthy page',async()=>{
 const result=await probe(target,async()=>({ok:true,status:200,url:target[0].url,headers:{get:()=> 'application/json'},text:async()=>'{ "brand": "DTF" }'}));
 assert.equal(result[0].ok,false);
 assert.equal(result[0].reason,'unexpected content type');
});
test('accepts valid HTML with charset information',async()=>{
 const result=await probe(target,async()=>({ok:true,status:200,url:target[0].url,headers:{get:()=> 'text/html; charset=utf-8'},text:async()=>'<title>DTF</title>'}));
 assert.equal(result[0].ok,true);
});

test('rejects missing content-type header',async()=>{
 const result=await probe(target,async()=>({ok:true,status:200,url:target[0].url,headers:{get:()=>null},text:async()=>'<title>DTF</title>'}));
 assert.equal(result[0].ok,false);
 assert.equal(result[0].reason,'unexpected content type');
});
test('rejects same-site redirect to a different route',async()=>{
 const result=await probe(target,async()=>({ok:true,status:200,url:'https://dtfseeds.com/learn/',headers:{get:()=> 'text/html'},text:async()=>'<title>DTF</title>'}));
 assert.equal(result[0].ok,false);
 assert.equal(result[0].reason,'unexpected redirect destination');
});
test('accepts canonical trailing slash normalization',async()=>{
 const result=await probe(target,async()=>({ok:true,status:200,url:'https://dtfseeds.com',headers:{get:()=> 'text/html'},text:async()=>'<title>DTF</title>'}));
 assert.equal(result[0].ok,true);
});
