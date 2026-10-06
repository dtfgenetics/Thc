#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const contractPath='data/project-os/deployment-fingerprint-contract.json';
const outPath=process.env.PROJECT_OS_FINGERPRINT_OUT||'site/public-route-patch/assets/project-os-release-fingerprint.json';
const contract=JSON.parse(fs.readFileSync(contractPath,'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const dataHashes={};
for(const file of contract.hashedInputs){
 const bytes=fs.readFileSync(file);
 dataHashes[file]=hash(bytes);
}
const sourceRevision=process.env.PROJECT_OS_SOURCE_REVISION||process.env.GITHUB_SHA;
const buildId=process.env.PROJECT_OS_BUILD_ID||process.env.GITHUB_RUN_ID;
const generatedAt=process.env.PROJECT_OS_GENERATED_AT||new Date().toISOString();
if(!sourceRevision) throw new Error('PROJECT_OS_SOURCE_REVISION or GITHUB_SHA required');
if(!buildId) throw new Error('PROJECT_OS_BUILD_ID or GITHUB_RUN_ID required');
const canonical=JSON.stringify({repository:contract.sourceOfTruth,sourceRevision,buildId,dataHashes});
const fingerprint={
 schemaVersion:1,
 repository:contract.sourceOfTruth,
 sourceRevision,
 buildId:String(buildId),
 generatedAt,
 bundleHash:hash(canonical),
 dataHashes
};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(fingerprint,null,2)+'\n');
console.log(JSON.stringify(fingerprint));
