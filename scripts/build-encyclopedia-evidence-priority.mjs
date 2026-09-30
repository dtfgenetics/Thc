#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd(), enc=path.join(root,'content','encyclopedia');
const registry=JSON.parse(fs.readFileSync(path.join(enc,'current-controlled-registry.json'),'utf8'));
const batches=fs.readdirSync(path.join(enc,'evidence')).filter(x=>/^evidence-batch-\d+\.json$/.test(x)).sort()
  .map(x=>JSON.parse(fs.readFileSync(path.join(enc,'evidence',x),'utf8')));
const mapped=new Map();
for(const b of batches) for(const e of b.claimEvidence||[]){
  if(!mapped.has(e.lessonId)) mapped.set(e.lessonId,[]);
  mapped.get(e.lessonId).push(e);
}
const lessons=new Map();
function walk(d){
  for(const e of fs.readdirSync(d,{withFileTypes:true})){
    const p=path.join(d,e.name);
    if(e.isDirectory()) walk(p);
    else if(e.isFile()&&e.name.endsWith('.json')){
      let j;try{j=JSON.parse(fs.readFileSync(p,'utf8'))}catch{continue}
      if(/^THC-ENC-\d{3}$/.test(j.id||'')) lessons.set(j.id,j);
      for(const x of Array.isArray(j.lessons)?j.lessons:[]) if(/^THC-ENC-\d{3}$/.test(x?.id||'')) lessons.set(x.id,x);
    }
  }
}
walk(enc);
const txt=v=>JSON.stringify(v||'').toLowerCase();
const patterns={
  numerical:/\b\d+(?:\.\d+)?\s*(?:%|ppm|ppfd|dli|ec|ph|°c|°f|hours?|days?|weeks?|ml|l|mg|g|kg|kpa|µmol|umol)\b/i,
  legal:/\b(legal|law|regulation|regulatory|label requirement|jurisdiction|statute|compliance|pesticide)\b/i,
  diagnostic:/\b(diagnos|deficien|toxicit|pathogen|disease|symptom|pest|viroid|infection|disorder)\b/i,
  causal:/\b(causes?|increases?|decreases?|reduces?|improves?|suppresses?|induces?|results in|leads to)\b/i,
  cultivar:/\b(cultivar|genotype|strain|chemotype|variety|lineage|clone)\b/i,
  safety:/\b(safe|safety|hazard|toxic|emergency|exposure|protective|ppe)\b/i
};
const rows=[];
for(const entry of registry.entries||[]){
  const l=lessons.get(entry.id)||{};
  const blob=[l.objective,l.coreScience,l.cultivationRelevance,l.measureAndRecord,l.evidenceLimits,l.misconceptions].map(txt).join(' ');
  const flags=Object.fromEntries(Object.entries(patterns).map(([k,r])=>[k,r.test(blob)]));
  const score=(flags.numerical?4:0)+(flags.legal?5:0)+(flags.diagnostic?5:0)+(flags.causal?3:0)+(flags.cultivar?2:0)+(flags.safety?5:0);
  const evidence=mapped.get(entry.id)||[];
  const sourceCount=Array.isArray(l.sourceNotes)?l.sourceNotes.length:0;
  const priority=Math.max(0,score-(evidence.length*2))+(sourceCount<2?3:0);
  rows.push({
    id:entry.id,number:entry.number,part:entry.part,title:entry.title,
    riskFlags:flags,riskScore:score,sourceNotes:sourceCount,
    claimEvidenceCount:evidence.length,
    evidenceIds:evidence.map(x=>x.evidenceId),
    priorityScore:priority,
    status:evidence.length?'claim-evidence-started':'claim-evidence-needed'
  });
}
rows.sort((a,b)=>b.priorityScore-a.priorityScore||b.riskScore-a.riskScore||a.number-b.number);
const summary={
  lessonCount:rows.length,
  withClaimEvidence:rows.filter(x=>x.claimEvidenceCount>0).length,
  withoutClaimEvidence:rows.filter(x=>x.claimEvidenceCount===0).length,
  highPriorityUnmapped:rows.filter(x=>x.claimEvidenceCount===0&&x.priorityScore>=8).length
};
const out={schemaVersion:1,generatedAt:new Date().toISOString(),summary,priority:rows.slice(0,120),lessons:rows};
const dest=path.join(root,'data','encyclopedia-evidence-priority.json');
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(out,null,2)+'\n');
console.log(`Evidence priority audit: ${summary.withClaimEvidence}/${summary.lessonCount} lessons mapped; ${summary.highPriorityUnmapped} high-priority unmapped lessons.`);
console.log('Top unmapped: '+rows.filter(x=>!x.claimEvidenceCount).slice(0,20).map(x=>x.id+'('+x.priorityScore+')').join(', '));
if(rows.length!==420) process.exit(1);
