#!/usr/bin/env node
import fs from 'node:fs';

export function verifyFingerprint(contract,expected,observed){
 const errors=[];
 for(const field of contract.requiredFields||[]){
  if(observed?.[field]===undefined||observed?.[field]===null||observed?.[field]==='') errors.push('observed fingerprint missing '+field);
 }
 if(observed?.repository!==contract.sourceOfTruth) errors.push('repository mismatch');
 if(contract.liveVerification?.requireExactSourceRevision && expected.sourceRevision!==observed?.sourceRevision) errors.push('sourceRevision mismatch');
 if(contract.liveVerification?.requireExactBundleHash && expected.bundleHash!==observed?.bundleHash) errors.push('bundleHash mismatch');
 for(const [key,value] of Object.entries(expected.dataHashes||{})){
  if(observed?.dataHashes?.[key]!==value) errors.push('data hash mismatch '+key);
 }
 return errors;
}

export function reconcileQueue(queue,{workItemId,expected,observed,verifiedAt}){
 const next=structuredClone(queue);
 const item=next.items?.find(x=>x.workItemId===workItemId);
 if(!item) throw new Error('work item not found: '+workItemId);
 const contract=JSON.parse(fs.readFileSync('data/project-os/deployment-fingerprint-contract.json','utf8'));
 const errors=verifyFingerprint(contract,expected,observed);
 item.deployment=item.deployment||{};
 item.deployment.fingerprint=observed||null;
 item.deployment.verifiedAt=verifiedAt||new Date().toISOString();
 if(errors.length){
  item.deployment.state='failed';
  item.state='failed';
  item.blocker={type:'live_drift',message:errors.join('; ')};
  item.nextAction='Repair deployment drift and rerun Project OS live fingerprint verification.';
 }else{
  item.deployment.state='verified';
  item.blocker=null;
 }
 return {queue:next,errors};
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const args=process.argv.slice(2);
 const expectedPath=args[0], observedPath=args[1];
 if(!expectedPath||!observedPath) throw new Error('usage: reconcile-project-os-deployment.mjs expected.json observed.json [--queue path --work-item id --write]');
 const value=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};
 const queuePath=value('--queue');
 const workItemId=value('--work-item');
 const write=args.includes('--write');
 const expected=JSON.parse(fs.readFileSync(expectedPath,'utf8'));
 const observed=JSON.parse(fs.readFileSync(observedPath,'utf8'));
 const contract=JSON.parse(fs.readFileSync('data/project-os/deployment-fingerprint-contract.json','utf8'));
 let errors=verifyFingerprint(contract,expected,observed);
 if(queuePath||workItemId||write){
  if(!queuePath||!workItemId) throw new Error('--queue and --work-item are required together');
  const queue=JSON.parse(fs.readFileSync(queuePath,'utf8'));
  const result=reconcileQueue(queue,{workItemId,expected,observed});
  errors=result.errors;
  if(write) fs.writeFileSync(queuePath,JSON.stringify(result.queue,null,2)+'\n');
 }
 if(errors.length){console.error(errors.join('\n'));process.exit(1)}
 console.log('Project OS deployment fingerprint verified: '+observed.sourceRevision);
}
