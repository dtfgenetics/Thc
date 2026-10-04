#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';

const root=process.cwd();
const outPath=path.join(root,'data','encyclopedia-consistency-audit.json');
const lessons=readCanonicalEncyclopediaLessons(root);
const strict=process.argv.includes('--strict');
const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const tokens=v=>new Set(norm(v).split(' ').filter(x=>x.length>2));
const jaccard=(a,b)=>{
  const A=tokens(a), B=tokens(b);
  if(!A.size&&!B.size) return 1;
  const inter=[...A].filter(x=>B.has(x)).length;
  return inter/(A.size+B.size-inter||1);
};

if(lessons.length!==420) throw new Error('Consistency audit requires 420 canonical lessons; found '+lessons.length);

const termUses=new Map();
const findings=[];
const measurementPatterns=[
  {
    id:'ambiguous-ppm-scale',
    re:/\b\d+(?:\.\d+)?\s*ppm\b/i,
    clear:/\b(?:500|700)[ -]?scale\b|\bmg\/?l\b|\bNaCl equivalent\b|\bTDS scale\b/i,
    note:'Numeric PPM/TDS should identify the conversion basis or use an unambiguous mass-concentration unit when appropriate.'
  },
  {
    id:'ec-missing-unit',
    re:/\bEC\s*(?:of|=|:)?\s*\d+(?:\.\d+)?\b/i,
    clear:/\b(?:mS\/?cm|dS\/?m|µS\/?cm|uS\/?cm)\b/i,
    note:'Numeric EC should carry a conductivity unit.'
  },
  {
    id:'vpd-missing-kpa',
    re:/\bVPD\s*(?:of|=|:)?\s*\d+(?:\.\d+)?\b/i,
    clear:/\bkPa\b/i,
    note:'Numeric VPD should identify kPa or another explicit pressure unit.'
  },
  {
    id:'ppfd-missing-photon-unit',
    re:/\bPPFD\s*(?:of|=|:)?\s*\d+(?:\.\d+)?\b/i,
    clear:/\b(?:µmol|umol).*?(?:m[-²^2]|m2).*?(?:s[-¹^1]|s1|second)/i,
    note:'Numeric PPFD should identify photon-flux-density units.'
  },
  {
    id:'dli-missing-unit',
    re:/\bDLI\s*(?:of|=|:)?\s*\d+(?:\.\d+)?\b/i,
    clear:/\bmol.*?(?:m[-²^2]|m2).*?(?:d[-¹^1]|day)/i,
    note:'Numeric DLI should identify mol per square metre per day.'
  }
];

for(const lesson of lessons){
  const fields=[
    ['objective',lesson.objective],
    ...arr(lesson.coreScience).map((v,i)=>['coreScience['+i+']',v]),
    ...arr(lesson.cultivationRelevance).map((v,i)=>['cultivationRelevance['+i+']',v]),
    ...arr(lesson.measureAndRecord||lesson.measurements).map((v,i)=>['measureAndRecord['+i+']',typeof v==='string'?v:JSON.stringify(v)]),
    ...arr(lesson.misconceptions).map((v,i)=>['misconceptions['+i+']',typeof v==='string'?v:JSON.stringify(v)]),
    ...arr(lesson.evidenceLimits).map((v,i)=>['evidenceLimits['+i+']',v])
  ];
  for(const [field,value] of fields){
    const text=clean(value);
    for(const rule of measurementPatterns){
      if(rule.re.test(text)&&!rule.clear.test(text)){
        findings.push({
          findingId:rule.id,
          severity:'review',
          lessonId:lesson.id,
          field,
          excerpt:text.slice(0,320),
          note:rule.note
        });
      }
    }
    if(/\b(?:always|never|universally|guarantees?|optimal|ideal)\b/i.test(text)&&/\b\d+(?:\.\d+)?\b/.test(text)){
      findings.push({
        findingId:'absolute-numerical-language',
        severity:'review',
        lessonId:lesson.id,
        field,
        excerpt:text.slice(0,320),
        note:'Absolute or optimization language paired with a number should be checked for context, scope, and evidence limits.'
      });
    }
  }

  const termRows=arr(lesson.terms).length?arr(lesson.terms):arr(lesson.termsToKnow);
  for(const row of termRows){
    const term=typeof row==='string'?row:row?.term;
    const definition=typeof row==='string'?'':row?.definition;
    if(!term||!definition) continue;
    const key=norm(term);
    if(!termUses.has(key)) termUses.set(key,[]);
    termUses.get(key).push({lessonId:lesson.id,term,definition:clean(definition)});
  }
}

const definitionDrift=[];
for(const [key,uses] of termUses){
  if(uses.length<2) continue;
  let minSimilarity=1, pair=null;
  for(let i=0;i<uses.length;i++) for(let j=i+1;j<uses.length;j++){
    const sim=jaccard(uses[i].definition,uses[j].definition);
    if(sim<minSimilarity){minSimilarity=sim;pair=[uses[i],uses[j]];}
  }
  if(minSimilarity<0.22){
    definitionDrift.push({
      normalizedTerm:key,
      useCount:uses.length,
      minimumDefinitionSimilarity:Number(minSimilarity.toFixed(3)),
      examplePair:pair,
      status:'review_for_definition_scope_or_drift'
    });
  }
}

const byLesson=new Map(lessons.map(l=>[l.id,[]]));
for(const finding of findings) byLesson.get(finding.lessonId)?.push(finding);
const lessonRows=lessons.map(l=>({
  lessonId:l.id,
  number:Number(l.number),
  findingCount:byLesson.get(l.id)?.length||0,
  findings:byLesson.get(l.id)||[]
}));

const counts={};
for(const f of findings) counts[f.findingId]=(counts[f.findingId]||0)+1;
const output={
  schemaVersion:'1.0.0',
  artifactId:'thc-encyclopedia-consistency-audit',
  generatedBy:'scripts/audit-encyclopedia-consistency.mjs',
  generatedAt:new Date().toISOString(),
  scope:'Cross-corpus candidate audit for measurement notation and repeated-term definition drift. Findings require human/science review and are not automatically contradictions.',
  summary:{
    lessonCount:lessons.length,
    lessonsWithMeasurementOrLanguageFindings:lessonRows.filter(x=>x.findingCount>0).length,
    findingCount:findings.length,
    findingCounts:counts,
    repeatedTermsReviewed:[...termUses.values()].filter(x=>x.length>1).length,
    definitionDriftCandidates:definitionDrift.length
  },
  definitionDrift,
  lessons:lessonRows
};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log('Encyclopedia consistency audit');
console.log(JSON.stringify(output.summary,null,2));
console.log('Wrote data/encyclopedia-consistency-audit.json');

if(strict&&findings.some(x=>x.severity==='error')) process.exit(1);
