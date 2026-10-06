#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {verifyLive} from './verify-project-os-release-fingerprint-live.mjs';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'project-os-live-'));
const out=path.join(tmp,'expected.json');
const env={...process.env,PROJECT_OS_SOURCE_REVISION:'abc123',PROJECT_OS_BUILD_ID:'42',PROJECT_OS_GENERATED_AT:'2026-10-06T10:00:00Z',PROJECT_OS_FINGERPRINT_OUT:out};
const built=spawnSync(process.execPath,['scripts/build-project-os-release-fingerprint.mjs'],{encoding:'utf8',env});
assert.equal(built.status,0,built.stderr);
const expected=JSON.parse(fs.readFileSync(out,'utf8'));
const okFetch=async()=>({ok:true,status:200,json:async()=>structuredClone(expected)});
const ok=await verifyLive({expectedPath:out,url:'https://example.test/fingerprint.json',fetchImpl:okFetch});
assert.deepEqual(ok.errors,[]);
const badFetch=async()=>({ok:true,status:200,json:async()=>({...expected,bundleHash:'bad'})});
const bad=await verifyLive({expectedPath:out,url:'https://example.test/fingerprint.json',fetchImpl:badFetch});
assert.ok(bad.errors.some(x=>x.includes('bundleHash mismatch')));
fs.rmSync(tmp,{recursive:true,force:true});
console.log('Project OS live fingerprint verifier tests passed');
