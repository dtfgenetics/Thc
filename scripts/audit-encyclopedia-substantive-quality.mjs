#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';

const root=process.cwd();
const encRoot=path.join(root,'content','encyclopedia');
const registry=JSON.parse(fs.readFileSync(path.join(encRoot,'current-controlled-registry.json'),'utf8'));
const outPath=path.join(root,'data','encyclopedia-substantive-quality-audit.json');
const arr=v=>Array.isArray(v)?v:[];
const txt=v=>String(v??'').replace(/\s+/g,' ').trim();
const words=v=>txt(v).split(/\s+/).filter(Boolean).length;
const canonicalLessons=readCanonicalEncyclopediaLessons(root);
const lessons=new Map(canonicalLessons.map(lesson=>[
  lesson.id,
  {...lesson,__file:lesson.__path}
]));

if(canonicalLessons.length!==420){
  console.error(`Substantive audit requires 420 canonical lessons; found ${canonicalLessons.length}.`);
  process.exit(1);
}
for(const lesson of canonicalLessons){
  if(lesson.__sourceKind!=='individual-canonical'){
    console.error(`${lesson.id}: substantive audit must use individual canonical lesson files, found ${lesson.__sourceKind}.`);
    process.exit(1);
  }
}

const values=(l,a,b)=>arr(l?.[a]).length?arr(l[a]):arr(l?.[b]);
const sources=l=>values(l,'sourceNotes','evidence');
const measures=l=>values(l,'measureAndRecord','measurements');
const terms=l=>values(l,'terms','termsToKnow');
const checks=l=>arr(l.knowledgeCheck).length?arr(l.knowledgeCheck):arr(l.assessment?.knowledgeCheck);
const cross=l=>{
  if(typeof l.crossLinks==='string') return l.crossLinks.match(/THC-ENC-\d{3}/g)||[];
  if(Array.isArray(l.crossLinks)) return l.crossLinks;
  if(l.crossLinks&&typeof l.crossLinks==='object') return [...arr(l.crossLinks.prerequisiteLessonIds),...arr(l.crossLinks.relatedLessonIds)];
  return [];
};
const generic=/\b(see (the )?lesson|as appropriate|where appropriate|proper|correct|best practice|monitor closely|follow guidance|use judgment)\b/i;
const sourceAuthority=/\b(university|extension|usda|epa|nist|cornell|penn state|journal|doi|frontiers|plants|hortscience|pubmed|ncbi|ashrae|astm|iso|fao|who|government|department|institute|society)\b/i;

const rows=(registry.entries||[]).map(entry=>{
  const l=lessons.get(entry.id)||{};
  const objective=txt(l.objective||arr(l.learningObjectives)[0]);
  const core=arr(l.coreScience);
  const relevance=arr(l.cultivationRelevance);
  const measure=measures(l);
  const misconception=arr(l.misconceptions);
  const limits=arr(l.evidenceLimits).length?arr(l.evidenceLimits):[l.evidenceLimits].filter(Boolean);
  const src=sources(l);
  const issues=[];
  if(words(objective)<12) issues.push('thin-objective');
  if(core.length<3||core.filter(x=>words(typeof x==='string'?x:JSON.stringify(x))>=12).length<2) issues.push('thin-core-science');
  if(relevance.length<1||relevance.every(x=>words(x)<12)) issues.push('thin-cultivation-relevance');
  if(measure.length<2||measure.filter(x=>words(typeof x==='string'?x:JSON.stringify(x))>=5).length<2) issues.push('thin-measurement-guidance');
  if(misconception.length<2||misconception.filter(x=>words(typeof x==='string'?x:JSON.stringify(x))>=10).length<2) issues.push('thin-misconceptions');
  if(limits.length<1||limits.every(x=>words(x)<12)) issues.push('thin-evidence-limits');
  if(src.length<2) issues.push('insufficient-sources');
  if(src.length>=2&&src.filter(x=>sourceAuthority.test(txt(typeof x==='string'?x:JSON.stringify(x)))).length<1) issues.push('weak-source-authority-signal');
  if(cross(l).length<2) issues.push('thin-cross-links');
  const body=[objective,...core,...relevance,...measure,...misconception,...limits].map(x=>typeof x==='string'?x:JSON.stringify(x));
  if(body.filter(x=>generic.test(x)).length>=3) issues.push('generic-language');
  const totalWords=body.reduce((n,x)=>n+words(x),0);
  if(totalWords<180) issues.push('low-instructional-depth');
  return {
    id:entry.id,number:entry.number,part:entry.part,title:entry.title,file:l.__file||null,
    metrics:{objectiveWords:words(objective),coreScience:core.length,cultivationRelevance:relevance.length,measurements:measure.length,misconceptions:misconception.length,evidenceLimits:limits.length,sources:src.length,crossLinks:cross(l).length,storedChecks:checks(l).length,totalInstructionalWords:totalWords},
    issues,issueCount:issues.length
  };
});
const issueCounts={};
for(const row of rows) for(const issue of row.issues) issueCounts[issue]=(issueCounts[issue]||0)+1;
const ranked=[...rows].sort((a,b)=>b.issueCount-a.issueCount||a.number-b.number);
const byPart=[...new Set(rows.map(x=>x.part))].map(part=>{
  const p=rows.filter(x=>x.part===part);
  return {part,count:p.length,lessonsWithIssues:p.filter(x=>x.issueCount).length,totalIssues:p.reduce((n,x)=>n+x.issueCount,0),averageInstructionalWords:Math.round(p.reduce((n,x)=>n+x.metrics.totalInstructionalWords,0)/p.length)};
});
const output={schemaVersion:1,generatedAt:new Date().toISOString(),lessonCount:rows.length,lessonsWithIssues:rows.filter(x=>x.issueCount).length,issueCounts,byPart,priority:ranked.slice(0,100),lessons:rows};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log(`Substantive encyclopedia audit: ${rows.length} lessons; ${output.lessonsWithIssues} with one or more substantive findings.`);
console.log(JSON.stringify(issueCounts,null,2));
console.log('Highest-priority lessons: '+ranked.slice(0,20).map(x=>x.id+'('+x.issueCount+')').join(', '));
if(rows.length!==420) process.exit(1);
