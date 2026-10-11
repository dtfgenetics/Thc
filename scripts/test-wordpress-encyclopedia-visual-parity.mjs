#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'thc-wordpress-visual-parity-'));
const script=path.join(path.dirname(fileURLToPath(import.meta.url)),'audit-wordpress-encyclopedia-visual-parity.mjs');
const filename='THC-ENC-041_Scientific_Root_Anatomy.jpg';
const source=Buffer.from('ffd8ff0046495854555245','hex');
const hash=crypto.createHash('sha256').update(source).digest('hex');
const asset=path.join(root,'site/wordpress/assets/infographics',filename);
const report=path.join(root,'publisher.json');
const evidence=path.join(root,'audit.json');
fs.mkdirSync(path.dirname(asset),{recursive:true});
fs.writeFileSync(asset,source);
let imageBytes=source,imageMime='image/jpeg',markerEnabled=true,imageStatus=200;
const server=http.createServer((req,res)=>{
  if(req.url==='/uploads/'+filename){
    res.writeHead(imageStatus,{'Content-Type':imageMime});res.end(imageBytes);return;
  }
  if(req.url==='/learn/encyclopedia/thc-enc-041/'){
    const marker=markerEnabled?'data-thc-lesson-visual-id="THC-ENC-041"':'';
    res.writeHead(200,{'Content-Type':'text/html'});
    res.end('<html><figure '+marker+'><img src="http://127.0.0.1:'+server.address().port+'/uploads/'+filename+'"></figure></html>');
    return;
  }
  res.writeHead(404);res.end();
});
const run=env=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[script],{cwd:root,env:{...process.env,...env}});
  let stdout='',stderr='';
  child.stdout.on('data',x=>stdout+=x);
  child.stderr.on('data',x=>stderr+=x);
  child.on('error',reject);
  child.on('close',code=>resolve({code,stdout,stderr}));
});
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const record={id:'THC-ENC-041',assetPath:filename,assetSha256:hash,link:base+'/learn/encyclopedia/thc-enc-041/',mediaSourceUrl:base+'/uploads/'+filename,storedContentVerified:true};
  const save=(updated)=>fs.writeFileSync(report,JSON.stringify({updated,lessonVisualsAttached:updated.length}));
  const env={ENCYCLOPEDIA_VISUAL_PUBLICATION_REPORT:report,ENCYCLOPEDIA_VISUAL_ALLOW_LOCALHOST:'1',ENCYCLOPEDIA_VISUAL_LIVE_AUDIT_REPORT:evidence};
  save([record]);
  let result=await run(env);
  assert.equal(result.code,0,`Expected full page and image verification PASS: ${result.stderr} ${result.stdout}`);
  let audit=JSON.parse(fs.readFileSync(evidence,'utf8'));
  assert.deepEqual(audit.summary,{expected:1,verified:1,failures:0,passed:true});
  imageBytes=Buffer.concat([source,Buffer.from('tampered')]);
  assert.notEqual((await run(env)).code,0,'Modified public image passed');
  imageBytes=source;imageMime='text/html';
  assert.notEqual((await run(env)).code,0,'Bad MIME passed');
  imageMime='image/jpeg';imageStatus=404;
  assert.notEqual((await run(env)).code,0,'Missing image passed');
  imageStatus=200;markerEnabled=false;
  assert.notEqual((await run(env)).code,0,'Missing lesson figure marker passed');
  markerEnabled=true;
  save([{...record,assetSha256:'0'.repeat(64)}]);
  assert.notEqual((await run(env)).code,0,'Forged publication SHA passed');
  save([record,record]);
  assert.notEqual((await run(env)).code,0,'Duplicate publisher rows passed');
  save([{...record,mediaSourceUrl:'https://attacker.example/uploads/'+filename}]);
  assert.notEqual((await run(env)).code,0,'Untrusted image origin passed');
  save([]);
  assert.notEqual((await run(env)).code,0,'Empty publication proof passed');
  console.log('WordPress visual live parity PASS: valid publication matched; tampered bytes, missing image/figure, bad MIME, forged hash, duplicate rows, untrusted host and empty proof rejected.');
}finally{
  await new Promise(resolve=>server.close(resolve));
  fs.rmSync(root,{recursive:true,force:true});
}
