import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildCoreRoutes,validateDirectory,checkLessonResponse,auditLive,ORIGIN} from './encyclopedia-live-420-audit.mjs';
const entries=Array.from({length:420},(_,i)=>({id:`THC-ENC-${String(i+1).padStart(3,'0')}`,number:i+1}));
const routes=buildCoreRoutes(entries);
const html=(route,canonical=ORIGIN+route.path)=>`<html><head><link href="${canonical}" rel="canonical"></head><body><main><span>${route.id}</span><h1>Specific lesson</h1></main></body></html>`;
const response=(body,status=200,type='text/html')=>({status,headers:{get:k=>k==='content-type'?type:null},text:async()=>body});
test('exactly 420 permanent IDs are required, no gaps or reordering',()=>{
 assert.equal(routes.length,420);assert.equal(routes[0].path,'/learn/encyclopedia/thc-enc-001/');assert.equal(routes.at(-1).path,'/learn/encyclopedia/thc-enc-420/');
 assert.throws(()=>buildCoreRoutes(entries.slice(1)),/exactly 420/);
 const corrupt=structuredClone(entries);corrupt[14].id='THC-ENC-016';assert.throws(()=>buildCoreRoutes(corrupt),/identity mismatch/);
});
test('directory must link every expected route, not just mention its ID',()=>{
 const index=routes.map(r=>`<a href="${r.path}">${r.id}</a>`).join('');
 assert.equal(validateDirectory(index,routes).pass,true);
 const broken=index.replace(`href="${routes[100].path}"`,'href="/missing/"');
 assert.deepEqual(validateDirectory(broken,routes).missing,['THC-ENC-101']);
});
test('a successful lesson requires exact canonical route, heading, and its own ID',()=>{
 const route=routes[0];assert.equal(checkLessonResponse(response('',200),html(route),route),null);
 assert.match(checkLessonResponse(response('',302),html(route),route),/HTTP 302/);
 assert.match(checkLessonResponse(response('',200,'application/json'),html(route),route),/content type/);
 assert.match(checkLessonResponse(response('',200),html(route,'https://example.org/'),route),/canonical route/);
 assert.match(checkLessonResponse(response('',200),html(route).replace(route.id,'THC-ENC-999'),route),/lesson-specific ID/);
 assert.match(checkLessonResponse(response('',200),html(route).replace('<h1>Specific lesson</h1>',''),route),/heading/);
});
test('audit checks directory plus each lesson and records failures without claiming full acceptance',async()=>{
 const subset=[routes[0],routes[419]];
 const index=subset.map(r=>`<a href="${r.path}">${r.id}</a>`).join('');
 const report=await auditLive({routes:subset,fetchImpl:async url=>response(url===ORIGIN+'/learn/encyclopedia/'?index:url.endsWith('420/')?html(subset[1]):html(subset[0])),now:()=> '2026-10-13T00:00:00Z'});
 assert.equal(report.allPassed,true);assert.equal(report.passing,2);assert.equal(report.total,2);assert.equal(report.coverage,'sample');assert.equal(report.full420Passed,false);
 const fail=await auditLive({routes:subset,fetchImpl:async url=>response(url===ORIGIN+'/learn/encyclopedia/'?index:'<h1>not a lesson</h1>')});
 assert.equal(fail.allPassed,false);assert.equal(fail.passing,0);
 assert.match(fail.scope,/not browser UX/);
});
test('missing directory and network errors fail closed',async()=>{
 const report=await auditLive({routes:[routes[0]],fetchImpl:async()=>{throw Error('offline')}});
 assert.equal(report.allPassed,false);assert.equal(report.results[0].reason,'request failure');assert.equal(report.directory.pass,false);
});
test('rejects duplicate or mismatched ID/path combinations',async()=>{
 await assert.rejects(()=>auditLive({routes:[routes[0],routes[0]]}),/Invalid route list/);
 await assert.rejects(()=>auditLive({routes:[{id:'THC-ENC-001',path:routes[1].path}]}),/Invalid route list/);
});
test('directory must be served as HTML',async()=>{
 const r=await auditLive({routes:[routes[0]],fetchImpl:async url=>response(url===ORIGIN+'/learn/encyclopedia/'?'{}':html(routes[0]),200,url===ORIGIN+'/learn/encyclopedia/'?'application/json':'text/html')});
 assert.equal(r.directory.pass,false);assert.equal(r.directory.reason,'unexpected directory content type');
});
test('420 arbitrary routes cannot masquerade as complete protected core',async()=>{
 const invalidCore=[...routes.slice(0,419),{id:'THC-ENC-999',path:'/learn/encyclopedia/thc-enc-999/'}];
 const directoryHtml=invalidCore.map(r=>`<a href="${r.path}">${r.id}</a>`).join('');
 const report=await auditLive({routes:invalidCore,fetchImpl:async url=>response(url===ORIGIN+'/learn/encyclopedia/'?directoryHtml:html(invalidCore.find(r=>url===ORIGIN+r.path)))});
 assert.equal(report.allPassed,true);assert.equal(report.full420Passed,false);assert.equal(report.coverage,'sample');
});
test('lesson ID appearing only inside a script or style block does not count as visible content',()=>{
 const route=routes[0];
 const hidden=`<html><head><link rel="canonical" href="${ORIGIN+route.path}"></head><body><h1>Generic heading</h1><script>window.lessonId='${route.id}'</script><style>/* ${route.id} */</style></body></html>`;
 assert.match(checkLessonResponse(response('',200),hidden,route),/missing lesson-specific ID/);
});
test('comments and HTML attributes cannot supply the visible lesson identity',()=>{
 const route=routes[0];
 const spoof=`<html><head><link rel="canonical" href="${ORIGIN+route.path}"></head><body><!-- ${route.id} --><main data-lesson-id="${route.id}"><h1>Generic heading</h1></main></body></html>`;
 assert.match(checkLessonResponse(response('',200),spoof,route),/missing lesson-specific ID/);
});
test('headings hidden in scripts or templates cannot satisfy lesson heading gate',()=>{
 const route=routes[0];
 const spoof=`<html><head><link rel="canonical" href="${ORIGIN+route.path}"></head><body><span>${route.id}</span><script>const html='<h1>Fake heading</h1>'</script><template><h1>Hidden heading</h1></template></body></html>`;
 assert.match(checkLessonResponse(response('',200),spoof,route),/missing lesson heading/);
});

test('canonical link must use a genuine rel attribute',()=>{
 const route=routes[0];
 assert.match(checkLessonResponse(response('',200),html(route).replace('rel="canonical"','data-rel="canonical"'),route),/canonical route mismatch/);
});

test('directory does not accept links in head or inert HTML',()=>{
 const first=routes[0],second=routes[1];
 const page=`<html><head><a href="${second.path}">not navigable</a></head><body><a href="${first.path}">real link</a><template><a href="${second.path}">inert</a></template></body></html>`;
 assert.deepEqual(validateDirectory(page,[first,second]).missing,[second.id]);
});
test('directory resolves relative links using the effective document base',()=>{
 const first=routes[0];
 const relative='<html><head></head><body><a href="thc-enc-001/">lesson</a></body></html>';
 assert.equal(validateDirectory(relative,[first]).pass,true);
 const redirected='<html><head><base href="/elsewhere/"></head><body><a href="thc-enc-001/">lesson</a></body></html>';
 assert.deepEqual(validateDirectory(redirected,[first]).missing,[first.id]);
});
test('commented-out document head cannot provide canonical metadata',()=>{
 const route=routes[0];
 const spoof=`<html><!-- <head><link rel="canonical" href="${ORIGIN+route.path}"></head> --><head></head><body><span>${route.id}</span><h1>Lesson</h1></body></html>`;
 assert.match(checkLessonResponse(response('',200),spoof,route),/canonical route mismatch/);
});
test('invalid timeout configuration is rejected before making requests',async()=>{
 await assert.rejects(()=>auditLive({routes:[routes[0]],timeoutMs:-1}),/Invalid timeoutMs/);
 await assert.rejects(()=>auditLive({routes:[routes[0]],timeoutMs:0}),/Invalid timeoutMs/);
});

test('directory accepts valid unquoted href attributes',()=>{
 const route=routes[0];
 assert.equal(validateDirectory(`<a href=${route.path}>Lesson</a>`,[route]).pass,true);
 assert.deepEqual(validateDirectory(`<a href=${route.path}?tracking=1>Lesson</a>`,[route]).missing,[route.id]);
});
