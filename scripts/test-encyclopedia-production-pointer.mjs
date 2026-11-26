#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const validator=fileURLToPath(new URL('./validate-encyclopedia-production-pointer.mjs',import.meta.url));
const original=Array.from({length:20},(_,i)=>`content/encyclopedia/volume-21/lessons/thc-enc-${401+i}.json`);
const tmp=mkdtempSync(path.join(tmpdir(),'thc-pointer-test-'));
function verify(files,floor=420){
  const dir=path.join(tmp,'site/wordpress/education/encyclopedia');
  const config=path.join(tmp,'configuration');
  mkdirSync(dir,{recursive:true});mkdirSync(config,{recursive:true});
  writeFileSync(path.join(dir,'current-production-batch.json'),JSON.stringify({batch:'volume21-final-release',lessonFiles:files}));
  writeFileSync(path.join(config,'encyclopedia-production-floor.json'),JSON.stringify({minimumPublishedThrough:floor}));
  return spawnSync(process.execPath,[validator],{cwd:tmp,encoding:'utf8'});
}
try{
  assert.equal(verify(original).status,0,'complete 20-lesson pointer must pass');
  assert.notEqual(verify(original.filter(x=>!x.includes('thc-enc-419'))).status,0,'missing 419 must fail');
  assert.notEqual(verify([...original,original[0]]).status,0,'duplicate ID must fail');
  assert.notEqual(verify([...original.slice(0,19),'unrecognized/path/thc-enc-420.json']).status,0,'malformed path must fail');
  assert.notEqual(verify([...original.slice(0,19),'content/encyclopedia/volume-20/lessons/thc-enc-420.json']).status,0,'incorrect volume must fail');
  assert.notEqual(verify(original.slice(0,-1)).status,0,'cutoff regression must fail');
  console.log('PASS: encyclopedia production pointer integrity (6 cases)');
}finally{rmSync(tmp,{recursive:true,force:true});}
