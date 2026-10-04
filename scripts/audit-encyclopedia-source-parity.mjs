#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args=process.argv.slice(2);
const rootArg=args.indexOf('--canonical-root');
if(rootArg<0||!args[rootArg+1]){
  console.error('Usage: node scripts/audit-encyclopedia-source-parity.mjs --canonical-root <path>');
  process.exit(2);
}
const localRoot=process.cwd();
const canonicalRoot=path.resolve(args[rootArg+1]);
const relRegistry='content/encyclopedia/current-controlled-registry.json';
const localRegistryPath=path.join(localRoot,relRegistry);
const canonicalRegistryPath=path.join(canonicalRoot,relRegistry);
const errors=[];

const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const stable=value=>{
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==='object'){
    return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  }
  return value;
};
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

if(!fs.existsSync(localRegistryPath)) errors.push('integration repository is missing '+relRegistry);
if(!fs.existsSync(canonicalRegistryPath)) errors.push('pinned canonical source is missing '+relRegistry);

let localRegistry=null;
let canonicalRegistry=null;
if(errors.length===0){
  localRegistry=readJson(localRegistryPath);
  canonicalRegistry=readJson(canonicalRegistryPath);
  const localNormalized=JSON.stringify(stable(localRegistry));
  const canonicalNormalized=JSON.stringify(stable(canonicalRegistry));
  if(localNormalized!==canonicalNormalized){
    errors.push('controlled 420-entry registry differs from the pinned canonical source');
  }
  if((canonicalRegistry.entries||[]).length!==420){
    errors.push('pinned canonical controlled registry must contain exactly 420 entries');
  }
}

let canonicalMissing=0;
let localMissing=0;
let bodyDrift=0;
let identicalBodies=0;
const driftExamples=[];
const reconciliationQueue=[];
const reconciliationSummary={canonicalPreferred:0,integrationPreferred:0,bodyOnly:0,controlConflict:0};
const controlledTitleById=new Map((localRegistry?.entries||[]).map(entry=>[entry.id,entry.title]));
for(let number=1;number<=420;number++){
  const volume=String(Math.ceil(number/20)).padStart(2,'0');
  const id=String(number).padStart(3,'0');
  const rel=`content/encyclopedia/volume-${volume}/lessons/thc-enc-${id}.json`;
  const canonical=path.join(canonicalRoot,rel);
  const local=path.join(localRoot,rel);
  if(!fs.existsSync(canonical)){ canonicalMissing++; continue; }
  if(!fs.existsSync(local)){ localMissing++; continue; }
  const canonicalDigest=digest(canonical);
  const localDigest=digest(local);
  if(canonicalDigest===localDigest) identicalBodies++;
  else {
    bodyDrift++;
    if(driftExamples.length<20) driftExamples.push(rel);
    const canonicalLesson=readJson(canonical);
    const localLesson=readJson(local);
    const lessonId=`THC-ENC-${id}`;
    const controlledTitle=controlledTitleById.get(lessonId)||null;
    const canonicalTitle=canonicalLesson.title||null;
    const localTitle=localLesson.title||null;
    const canonicalMatchesControl=Boolean(controlledTitle&&canonicalTitle===controlledTitle);
    const integrationMatchesControl=Boolean(controlledTitle&&localTitle===controlledTitle);
    let classification='control-conflict';
    if(canonicalMatchesControl&&!integrationMatchesControl) classification='canonical-preferred';
    else if(!canonicalMatchesControl&&integrationMatchesControl) classification='integration-preferred';
    else if(canonicalMatchesControl&&integrationMatchesControl) classification='body-only';
    if(classification==='canonical-preferred') reconciliationSummary.canonicalPreferred++;
    else if(classification==='integration-preferred') reconciliationSummary.integrationPreferred++;
    else if(classification==='body-only') reconciliationSummary.bodyOnly++;
    else reconciliationSummary.controlConflict++;
    reconciliationQueue.push({
      id:lessonId,
      number,
      path:rel,
      controlledTitle,
      canonicalTitle,
      integrationTitle:localTitle,
      canonicalMatchesControl,
      integrationMatchesControl,
      classification,
      canonical:{sha256:canonicalDigest,bytes:fs.statSync(canonical).size},
      integration:{sha256:localDigest,bytes:fs.statSync(local).size}
    });
  }
}
if(canonicalMissing>0) errors.push(`pinned canonical source is missing ${canonicalMissing} of 420 lesson files`);
if(localMissing>0) errors.push(`integration repository is missing ${localMissing} of 420 lesson files`);

const report={
  schemaVersion:1,
  auditId:'encyclopedia-source-parity-v1',
  canonicalRoot,
  controlledRegistryParity:errors.every(error=>!error.includes('controlled 420-entry registry')),
  canonicalRegistrySha256:fs.existsSync(canonicalRegistryPath)?digest(canonicalRegistryPath):null,
  localRegistrySha256:fs.existsSync(localRegistryPath)?digest(localRegistryPath):null,
  lessonFiles:{
    expected:420,
    canonicalMissing,
    localMissing,
    identicalBodies,
    differingBodies:bodyDrift,
    driftExamples
  },
  reconciliationSummary,
  reconciliationQueue,
  note:'Lesson-body drift is reported but not auto-resolved. Controlled-registry parity and 420-file existence are hard gates; lesson-body reconciliation remains quality-aware work.'
};
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/encyclopedia-source-parity.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

if(errors.length){
  console.error('Encyclopedia source parity failed with '+errors.length+' issue(s):');
  for(const error of errors) console.error(' - '+error);
  process.exit(1);
}
console.log(`Encyclopedia source control parity PASS; lesson-body drift reported: ${bodyDrift}/420 differing. Reconciliation queue: ${JSON.stringify(reconciliationSummary)}.`);
