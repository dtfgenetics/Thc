import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const guard=fs.readFileSync(new URL('../guard-atlas-preservation.mjs',import.meta.url),'utf8');
test('published mirror is traversal source',()=>{assert.match(guard,/pages\(mirror\)/);assert.doesNotMatch(guard,/walk\(dir, next\)/);});
test('deleted lesson fails closed',()=>{assert.match(guard,/missing canonical lesson/);});

test('canonical host and duplicate tags are guarded',()=>{assert.match(guard,/www\.dtfseeds\.com/);assert.match(guard,/found!==null/);});
test('instructional SVG removal is guarded',()=>{assert.match(guard,/instructionalSvgCount/);assert.match(guard,/instructional SVG count/);});

import os from 'node:os';
import {spawnSync} from 'node:child_process';
const body='Document observations and measurements before drawing a conclusion. '.repeat(16);
const html=(text,host='dtfseeds.com')=>'<link rel="canonical" href="https://'+host+'/atlas/leaf-module/example/"><main>'+text+'</main>';
function fixture(oldHtml,newHtml){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-regression-'));
 const mirror=path.join(tmp,'mirror'),canonical=path.join(tmp,'canonical');
 const route=path.join('leaf-module','example','index.html');
 try{
  for(const root of [mirror,canonical])fs.mkdirSync(path.dirname(path.join(root,route)),{recursive:true});
  fs.writeFileSync(path.join(mirror,route),oldHtml);
  if(newHtml!==null)fs.writeFileSync(path.join(canonical,route),newHtml);
  return spawnSync(process.execPath,[new URL('../guard-atlas-preservation.mjs',import.meta.url).pathname],{
   env:{...process.env,DTF_ATLAS_CANONICAL_DIR:canonical,DTF_ATLAS_MIRROR_DIR:mirror},encoding:'utf8',timeout:10000
  });
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
test('intact lesson is accepted by executable guard',()=>{
 const result=fixture(html(body),html(body));
 assert.equal(result.status,0,result.stderr);
});
test('deleted published lesson fails closed',()=>{
 const result=fixture(html(body),null);
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/missing canonical lesson/);
});
test('offsite canonical fails closed',()=>{
 const result=fixture(html(body),html(body,'example.org'));
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/canonical route/);
});
test('instructional SVG removal fails closed',()=>{
 const art='<svg role="img"><title>Teaching figure</title></svg>';
 const result=fixture(html(body+art),html(body));
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/instructional SVG count/);
});
