#!/usr/bin/env node
import fs from 'node:fs';

export function verifyFingerprint(contract,expected,observed){
 const errors=[];
 for(const f of contract.requiredFields||[]) if(observed?.[f]===undefined||observed?.[f]===null||observed?.[f]==='') errors.push('observed fingerprint missing '+f);
 if(observed?.repository!==contract.sourceOfTruth) errors.push('repository mismatch');
 if(contract.liveVerification?.requireExactSourceRevision && expected.sourceRevision!==observed?.sourceRevision) errors.push('sourceRevision mismatch');
 if(contract.liveVerification?.requireExactBundleHash && expected.bundleHash!==observed?.bundleHash) errors.push('bundleHash mismatch');
 for(const [k,v] of Object.entries(expected.dataHashes||{})) if(observed?.dataHashes?.[k]!==v) errors.push('data hash mismatch '+k);
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
 } else {
   item.deployment.state='verified';
   item.blocker=null;
 }
 return {queue:next,errors};
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const [expectedPath,observedPath]=process.argv.slice(2);
 if(!expectedPath||!observedPath) throw new Error('usage: reconcile-project-os-deployment.mjs expected.json observed.json');
 const contract=JSON.parse(fs.readFileSync('data/project-os/deployment-fingerprint-contract.json','utf8'));
 const expected=JSON.parse(fs.readFileSync(expectedPath,'utf8'));
 const observed=JSON.parse(fs.readFileSync(observedPath,'utf8'));
 const errors=verifyFingerprint(contract,expected,observed);
 if(errors.length){console.error(errors.join('\n'));process.exit(1)}
 console.log('Project OS deployment fingerprint verified: '+observed.sourceRevision);
}
