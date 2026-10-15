#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root=mkdtempSync(path.join(tmpdir(),'thc-live-fingerprint-'));
const lessons=new Map();
let corruptId=null;
const fingerprintOf=a=>createHash('sha256').update(JSON.stringify({
  id:a.id,title:a.title,objective:a.objective,terms:a.terms,
  coreScience:a.coreScience,cultivationRelevance:a.cultivationRelevance,
  measureAndRecord:a.measureAndRecord,misconceptions:a.misconceptions,
  evidenceLimits:a.evidenceLimits,crossLinks:a.crossLinks,
  sourceNotes:a.sourceNotes,assessment:a.knowledgeCheck
})).digest('hex').slice(0,24);
const lessonFiles=Array.from({length:420},(_,index)=>{
  const id='THC-ENC-'+String(index+1).padStart(3,'0');
  const lesson={id,title:'Fixture '+id,objective:'Verify a controlled source revision.',
    terms:[],coreScience:[],cultivationRelevance:[],measureAndRecord:[],
    misconceptions:[],evidenceLimits:[],crossLinks:[],sourceNotes:[],
    knowledgeCheck:['First question','Second question','Third question']};
  lessons.set(id,{lesson,fingerprint:fingerprintOf(lesson)});
  const file=path.join(root,id.toLowerCase()+'.json');
  writeFileSync(file,JSON.stringify(lesson));
  return file;
});
const manifest=path.join(root,'manifest.json');
writeFileSync(manifest,JSON.stringify({lessonFiles}));
const server=createServer((req,res)=>{
  const id=/^\/learn\/encyclopedia\/(thc-enc-\d{3})\/$/.exec(new URL(req.url,'http://localhost').pathname)?.[1]?.toUpperCase();
  if(!id||!lessons.has(id)){res.writeHead(404).end('Not found');return;}
  const fingerprint=id===corruptId?'000000000000000000000000':lessons.get(id).fingerprint;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end('<main data-thc-encyclopedia-id="'+id+'" data-thc-source-fingerprint="'+fingerprint+'">Key concepts · Terms to know</main>'+
    '<script type="application/ld+json">{"identifier":"'+id+'"}</script>');
});
async function run(site,report){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['scripts/verify-wordpress-encyclopedia-full-live.mjs'],{
      cwd:process.cwd(),
      env:{...process.env,WP_SITE_URL:site,ENCYCLOPEDIA_FULL_BATCH_FILE:manifest,
        ENCYCLOPEDIA_VERIFY_CONCURRENCY:'16',ENCYCLOPEDIA_VERIFY_ATTEMPTS:'1',
        ENCYCLOPEDIA_VERIFY_REPORT:report}
    });
    let stdout='',stderr='';
    child.stdout.on('data',chunk=>stdout+=chunk);
    child.stderr.on('data',chunk=>stderr+=chunk);
    child.on('error',reject);
    child.on('close',code=>resolve({code,stdout,stderr}));
  });
}
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const site='http://127.0.0.1:'+server.address().port;
  const positive=await run(site,path.join(root,'positive.json'));
  assert.equal(positive.code,0,positive.stderr);
  const success=JSON.parse(readFileSync(path.join(root,'positive.json'),'utf8'));
  assert.equal(success.verified,420);
  assert.equal(success.passed,true);
  corruptId='THC-ENC-210';
  const negative=await run(site,path.join(root,'negative.json'));
  assert.notEqual(negative.code,0,'wrong source fingerprint must fail acceptance');
  const failure=JSON.parse(readFileSync(path.join(root,'negative.json'),'utf8'));
  assert.equal(failure.verified,419);
  assert.equal(failure.failed,1);
  assert.equal(failure.passed,false);
  assert.equal(failure.failures[0].id,corruptId);
  assert.match(failure.failures[0].error,/source fingerprint mismatch/);
  console.log('420-route fingerprint acceptance: matching source passes; one stale source fails');
} finally {
  await new Promise(resolve=>server.close(resolve));
  rmSync(root,{recursive:true,force:true});
}
