#!/usr/bin/env node
import fs from 'node:fs';

export function collectMetrics({status,queue,env={}}){
 const metrics={generatedAt:env.PROJECT_OS_NOW||new Date().toISOString()};
 const enc=status?.lanes?.encyclopedia?.evidence;
 const encMatch=String(enc?.canonicalRoutes||'').match(/^(\d+)\/(\d+)$/);
 if(encMatch && enc?.visitorVerificationPassed===true && encMatch[1]===encMatch[2]) metrics.encyclopediaRoutesVerified=Number(encMatch[1]);

 const tools=status?.lanes?.tools?.evidence;
 if(Number.isFinite(Number(tools?.canonicalRoutes)) && /verified/i.test(String(tools?.liveAvailabilityVerified||''))){
  metrics.toolRoutesVerified=Number(tools.canonicalRoutes);
 }

 const active=(queue.items||[]).filter(x=>!['done','superseded','failed'].includes(x.state)&&x.branch);
 const counts=new Map();
 for(const x of active) counts.set(x.branch,(counts.get(x.branch)||0)+1);
 metrics.duplicateActiveRepairBranches=[...counts.values()].filter(n=>n>1).reduce((sum,n)=>sum+(n-1),0);

 if(env.PROJECT_OS_MAIN_GREEN==='1'||env.PROJECT_OS_MAIN_GREEN==='0') metrics.canonicalMainGreen=Number(env.PROJECT_OS_MAIN_GREEN);
 if(env.PROJECT_OS_RELEASE_FINGERPRINT_VISIBLE==='1'||env.PROJECT_OS_RELEASE_FINGERPRINT_VISIBLE==='0') metrics.releaseFingerprintVisible=Number(env.PROJECT_OS_RELEASE_FINGERPRINT_VISIBLE);
 if(env.PROJECT_OS_KNOWN_404S!==undefined && Number.isFinite(Number(env.PROJECT_OS_KNOWN_404S))) metrics.knownProduction404s=Number(env.PROJECT_OS_KNOWN_404S);
 if(env.PROJECT_OS_CRITICAL_A11Y!==undefined && Number.isFinite(Number(env.PROJECT_OS_CRITICAL_A11Y))) metrics.criticalAccessibilityFindings=Number(env.PROJECT_OS_CRITICAL_A11Y);
 return metrics;
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const status=JSON.parse(fs.readFileSync('data/project-os-status.json','utf8'));
 const queue=JSON.parse(fs.readFileSync('data/project-os/work-queue.json','utf8'));
 const metrics=collectMetrics({status,queue,env:process.env});
 const outIndex=process.argv.indexOf('--out');
 if(outIndex>=0){
  const file=process.argv[outIndex+1];
  if(!file) throw new Error('--out requires a path');
  fs.writeFileSync(file,JSON.stringify(metrics,null,2)+'\n');
 }
 console.log(JSON.stringify(metrics,null,2));
}
