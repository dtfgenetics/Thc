#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script=fileURLToPath(new URL('./validate-encyclopedia-copy-quality.mjs',import.meta.url));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'thc-encyclopedia-copy-'));
const lessonDir=path.join(temp,'content','encyclopedia','volume-03','lessons');
fs.mkdirSync(lessonDir,{recursive:true});
const file=path.join(lessonDir,'thc-enc-043.json');

const good={
  id:'THC-ENC-043',
  objective:'Understand root oxygen demand and inspect supporting environmental evidence.',
  coreScience:['Respiration requires sufficient oxygen for ongoing root metabolic function.'],
  cultivationRelevance:['Evaluate root-zone aeration and drainage before assuming a fertilizer problem.'],
  measureAndRecord:['Record substrate moisture, duration of saturation, and changes in root conditions.'],
  misconceptions:['All wet media are equally oxygenated: pore structure and renewal rates matter.'],
  evidenceLimits:['One irrigation observation alone cannot establish cause or generalize to other crops.'],
  sourceNotes:['Loreti E, Perata P. The Many Facets of Hypoxia in Plants. 2020. doi:10.3390/plants9060745.']
};
const run=()=>{
  const result=spawnSync(process.execPath,[script,'--json-report',path.join(temp,'report.json')],{cwd:temp,encoding:'utf8'});
  return {code:result.status,report:JSON.parse(fs.readFileSync(path.join(temp,'report.json'),'utf8'))};
};
try{
  fs.writeFileSync(file,JSON.stringify(good));
  let result=run();
  assert.equal(result.code,0,'clean claim/correction pair must pass');
  assert.equal(result.report.findingCount,0);

  fs.writeFileSync(file,JSON.stringify({...good,misconceptions:[
    'Roots need no oxygen: Roots respire.Correction: This is a second accidental correction joined to the entry.'
  ]}));
  result=run();
  assert.equal(result.code,1);
  assert.match(result.report.findings.map(f=>f.message).join(' '),/embedded claim\/correction label/);

  // A whitespace-separated extra correction must fail too (regression for
  // regex literals accidentally matching backslash-s instead of whitespace).
  fs.writeFileSync(file,JSON.stringify({...good,misconceptions:[
    'All wet media are oxygenated: pore structures differ. Correction: A second accidentally joined correction.'
  ]}));
  result=run();
  assert.equal(result.code,1);
  assert.match(result.report.findings.map(f=>f.message).join(' '),/embedded claim\\/correction label/);

  // No punctuation at the boundary also indicates two joined segments.
  fs.writeFileSync(file,JSON.stringify({...good,misconceptions:[
    'Roots respire continuously Correction: Oxygen availability still matters.'
  ]}));
  result=run();
  assert.equal(result.code,1);
  assert.match(result.report.findings.map(f=>f.message).join(' '),/embedded claim\\/correction label/);

  fs.writeFileSync(file,JSON.stringify({...good,sourceNotes:['Paper. 2020. Open sourcee']}));
  result=run();
  assert.equal(result.code,1);
  assert.match(result.report.findings.map(f=>f.message).join(' '),/malformed source-note label/);

  console.log('Encyclopedia copy-quality regression PASS: clean, concatenated, malformed source note.');
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}
