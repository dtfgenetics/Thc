import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {verifyFingerprint} from './reconcile-project-os-deployment.mjs';
const contract=JSON.parse(fs.readFileSync('data/project-os/deployment-fingerprint-contract.json','utf8'));
const sha='a'.repeat(40), hash='b'.repeat(64);
const complete=()=>({
 schemaVersion:1,repository:contract.sourceOfTruth,sourceRevision:sha,
 buildId:'build-1',generatedAt:'2026-10-12T00:00:00Z',
 bundleHash:hash,dataHashes:Object.fromEntries(contract.hashedInputs.map(p=>[p,hash]))
});
test('fully populated identical fingerprints compare without errors',()=>{
 const expected=complete();assert.deepEqual(verifyFingerprint(contract,expected,structuredClone(expected)),[]);
});
test('empty expected and observed fingerprints must not compare as valid',()=>{
 assert.ok(verifyFingerprint(contract,{},{}).length>0);
 assert.ok(verifyFingerprint(contract,null,null).length>0);
});
test('missing expected hash is rejected even when missing in observed fingerprint',()=>{
 const expected=complete(); const observed=complete();
 const key=contract.hashedInputs[0];delete expected.dataHashes[key];delete observed.dataHashes[key];
 assert.match(verifyFingerprint(contract,expected,observed).join('; '),/expected data hash missing or invalid/);
});
test('invalid expected source revision and bundle hash fail closed',()=>{
 const expected=complete();expected.sourceRevision='bad';expected.bundleHash='bad';
 assert.match(verifyFingerprint(contract,expected,complete()).join('; '),/expected sourceRevision/);
 assert.match(verifyFingerprint(contract,expected,complete()).join('; '),/expected bundleHash/);
});
