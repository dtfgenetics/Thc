#!/usr/bin/env node
import fs from 'node:fs';

export function reconcileItem(item, github, live) {
  const issues=[];
  const pr=item.pullRequest==null?null:github.pullRequests?.[String(item.pullRequest)];
  if(item.pullRequest!=null){
    if(!pr) issues.push({code:'github_pr_missing',message:'PR #'+item.pullRequest+' missing from GitHub snapshot'});
    else {
      if(item.headSha && pr.headSha!==item.headSha) issues.push({code:'github_head_drift',message:'queue head '+item.headSha+' != GitHub head '+pr.headSha});
      if(item.state==='done' && !pr.merged) issues.push({code:'done_pr_not_merged',message:'DONE item PR is not merged'});
      if(['claimed','in_progress','blocked'].includes(item.state) && pr.state==='closed' && !pr.merged) issues.push({code:'active_pr_closed_unmerged',message:'active item PR closed without merge'});
    }
  }
  if(item.deployment?.state==='verified'){
    if(!item.deployment.fingerprint) issues.push({code:'verified_without_fingerprint',message:'verified deployment has no fingerprint'});
    const observed=live?.[item.workItemId];
    if(!observed) issues.push({code:'live_evidence_missing',message:'verified deployment has no live snapshot'});
    else if(item.deployment.fingerprint?.sourceRevision && observed.sourceRevision!==item.deployment.fingerprint.sourceRevision)
      issues.push({code:'live_revision_drift',message:'live sourceRevision does not match queue fingerprint'});
  }
  return {workItemId:item.workItemId,ok:issues.length===0,issues};
}

export function reconcile(queue,github={},live={}){
  const items=(queue.items||[]).map(item=>reconcileItem(item,github,live));
  return {schemaVersion:1,ok:items.every(x=>x.ok),summary:{checked:items.length,drifted:items.filter(x=>!x.ok).length},items};
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
  const [queuePath,githubPath,livePath]=process.argv.slice(2);
  if(!queuePath||!githubPath||!livePath) throw new Error('usage: reconcile-project-os-state.mjs queue.json github.json live.json');
  const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
  const result=reconcile(read(queuePath),read(githubPath),read(livePath));
  console.log(JSON.stringify(result,null,2));
  if(!result.ok) process.exit(1);
}
