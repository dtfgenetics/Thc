#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const directory=mkdtempSync(path.join(tmpdir(),'thc-encyclopedia-config-'));
try {
  const manifestPath=path.join(directory,'manifest.json');
  const lessonFiles=Array.from({length:420},(_,index)=>`content/encyclopedia/thc-enc-${String(index+1).padStart(3,'0')}.json`);
  writeFileSync(manifestPath,JSON.stringify({lessonFiles}));
  for(const [setting,value] of [
    ['ENCYCLOPEDIA_VERIFY_CONCURRENCY','bogus'],
    ['ENCYCLOPEDIA_VERIFY_CONCURRENCY','0'],
    ['ENCYCLOPEDIA_VERIFY_CONCURRENCY','1.5'],
    ['ENCYCLOPEDIA_VERIFY_ATTEMPTS','NaN'],
    ['ENCYCLOPEDIA_VERIFY_ATTEMPTS','0'],
  ]){
    const run=spawnSync(process.execPath,['scripts/verify-wordpress-encyclopedia-full-live.mjs'],{
      encoding:'utf8',
      timeout:5000,
      env:{...process.env,ENCYCLOPEDIA_FULL_BATCH_FILE:manifestPath,ENCYCLOPEDIA_VERIFY_CONCURRENCY:'8',ENCYCLOPEDIA_VERIFY_ATTEMPTS:'4',[setting]:value},
    });
    assert.notEqual(run.status,0,`${setting}=${value} must not exit successfully`);
    assert.match(run.stderr,new RegExp(`Invalid ${setting}`));
    assert.doesNotMatch(run.stdout,/live verification PASS/);
  }
  console.log('Encyclopedia live verifier configuration guards passed');
} finally {
  rmSync(directory,{recursive:true,force:true});
}
