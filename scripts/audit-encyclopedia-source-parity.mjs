#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';

const targetPath='site/wordpress/education/encyclopedia-deployment-target.json';
const target=JSON.parse(fs.readFileSync(targetPath,'utf8'));
const registryPath=target.sourceRegistryPath;
const errors=[];

function gitBlobSha(content){
  const body=Buffer.isBuffer(content)?content:Buffer.from(content);
  const header=Buffer.from(`blob ${body.length}\0`);
  return crypto.createHash('sha1').update(header).update(body).digest('hex');
}

if(target.sourceRepository!=='dtfgenetics/thc-grow-hub') errors.push('unexpected canonical source repository');
if(!/^[0-9a-f]{40}$/.test(target.sourceSha||'')) errors.push('canonical source commit SHA is invalid');
if(registryPath!=='content/encyclopedia/current-controlled-registry.json') errors.push('canonical registry path is invalid');
if(!/^[0-9a-f]{40}$/.test(target.sourceRegistryBlobSha||'')) errors.push('canonical registry blob SHA is invalid');
if(!fs.existsSync(registryPath)) errors.push('integration copy is missing the controlled registry');

let actualBlobSha=null;
let registry=null;
if(fs.existsSync(registryPath)){
  const bytes=fs.readFileSync(registryPath);
  actualBlobSha=gitBlobSha(bytes);
  if(actualBlobSha!==target.sourceRegistryBlobSha){
    errors.push(`controlled registry blob mismatch: expected ${target.sourceRegistryBlobSha}, got ${actualBlobSha}`);
  }
  registry=JSON.parse(bytes.toString('utf8'));
  if(!Array.isArray(registry.entries)||registry.entries.length!==420){
    errors.push('controlled registry must contain exactly 420 entries');
  }
}

let missingLessonFiles=0;
for(let number=1;number<=420;number++){
  const volume=String(Math.ceil(number/20)).padStart(2,'0');
  const id=String(number).padStart(3,'0');
  const lessonPath=`content/encyclopedia/volume-${volume}/lessons/thc-enc-${id}.json`;
  if(!fs.existsSync(lessonPath)) missingLessonFiles++;
}
if(missingLessonFiles>0) errors.push(`integration repository is missing ${missingLessonFiles} of 420 lesson files`);

const report={
  schemaVersion:1,
  auditId:'encyclopedia-source-parity-v2',
  canonical:{
    repository:target.sourceRepository,
    commitSha:target.sourceSha,
    registryPath:target.sourceRegistryPath,
    registryBlobSha:target.sourceRegistryBlobSha
  },
  integration:{
    registryBlobSha:actualBlobSha,
    registryEntryCount:registry?.entries?.length??null,
    missingLessonFiles
  },
  parity:errors.length===0,
  note:'The production integration is bound to an immutable canonical commit and exact Git blob identity for the controlled 420-entry registry. Cross-repository lesson-body reconciliation remains separately quality-controlled.'
};
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/encyclopedia-source-parity.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

if(errors.length){
  console.error('Encyclopedia source parity failed with '+errors.length+' issue(s):');
  for(const error of errors) console.error(' - '+error);
  process.exit(1);
}
console.log('Encyclopedia source parity PASS: canonical commit and controlled-registry blob are immutably pinned.');
