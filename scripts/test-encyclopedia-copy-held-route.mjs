#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('./verify-wordpress-encyclopedia-copy-repair.mjs',import.meta.url),'utf8');
const executableSource=source
 .replace(/^#![^\n]*\n/u,'')
 .replace(/^import fs from 'node:fs';\s*/u,'');
const scan={scannedPublishedLessons:420,blocked:[{id:'THC-ENC-043',reason:'publication-hold',publicStatus:200}],candidates:[]};
const audit={failures:1,failedRoutes:[{id:'THC-ENC-043',status:200}]};
const run=(s,a)=>{
 const files={'/tmp/encyclopedia-copy-repair-scan.json':JSON.stringify(s),'live-encyclopedia-copy-audit.json':JSON.stringify(a)};
 const context={fs:{existsSync:p=>p in files,readFileSync:p=>files[p]},console:{log(){},error(){}},process:{exit:code=>{throw Error('exit '+code)}}};
 try { vm.runInNewContext(executableSource,context); return true; } catch(error){return String(error.message);}
};
assert.equal(run(scan,audit),true,'A held but reachable page is allowed');
assert.match(run(scan,{...audit,failedRoutes:[{id:'THC-ENC-043',status:404}]}),/exit 1/);
assert.match(run(scan,{...audit,failedRoutes:[{id:'THC-ENC-043',status:0}]}),/exit 1/);
assert.match(run({...scan,blocked:[{...scan.blocked[0],publicStatus:0}]},audit),/exit 1/);
console.log('Held-route public visibility regressions passed.');
