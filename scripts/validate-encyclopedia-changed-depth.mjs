#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const templatePath=path.join(root,'content','encyclopedia','lesson-template.json');
const template=JSON.parse(fs.readFileSync(templatePath,'utf8'));
const q=template.qualityTargets||{};

const targets={
  coreScienceMinimumWords:Number(q.coreScienceMinimumWords||180),
  coreScienceMinimumTeachingPoints:Number(q.coreScienceMinimumTeachingPoints||3),
  cultivationRelevanceMinimumWords:Number(q.cultivationRelevanceMinimumWords||80),
  measurementGuidanceMinimumWords:Number(q.measurementGuidanceMinimumWords||80),
  misconceptionMinimumCount:Number(q.misconceptionMinimumCount||3),
  evidenceLimitsMinimumWords:Number(q.evidenceLimitsMinimumWords||35),
  sourceMinimumCount:Number(q.sourceMinimumCount||3)
};

const arr=v=>Array.isArray(v)?v:[];
const flatten=value=>{
  if(value==null)return '';
  if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return String(value);
  if(Array.isArray(value))return value.map(flatten).join(' ');
  if(typeof value==='object')return Object.values(value).map(flatten).join(' ');
  return '';
};
const words=value=>flatten(value).trim().split(/\s+/).filter(Boolean).length;
const coreScience=l=>arr(l.coreScience).length?arr(l.coreScience):arr(l.sections?.mechanism);
const cultivation=l=>arr(l.cultivationRelevance).length?arr(l.cultivationRelevance):arr(l.sections?.cultivationRelevance);
const measurements=l=>arr(l.measureAndRecord).length?arr(l.measureAndRecord):arr(l.measurements).length?arr(l.measurements):arr(l.sections?.measurementAndRecords);
const misconceptions=l=>arr(l.misconceptions).length?arr(l.misconceptions):arr(l.sections?.misconceptions);
const evidenceLimits=l=>arr(l.evidenceLimits).length?arr(l.evidenceLimits):arr(l.sections?.evidenceLimits);
const sources=l=>arr(l.sourceNotes).length?arr(l.sourceNotes):arr(l.evidence);

const canonicalPattern=/^content\/encyclopedia\/volume-\d+\/lessons\/thc-enc-\d{3,}\.json$/;

function git(args){
  return execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
}

function changedFiles(){
  if(process.argv.includes('--all')){
    const volumes=fs.readdirSync(path.join(root,'content','encyclopedia'),{withFileTypes:true})
      .filter(x=>x.isDirectory()&&/^volume-\d+$/.test(x.name))
      .map(x=>x.name);
    return volumes.flatMap(volume=>{
      const dir=path.join(root,'content','encyclopedia',volume,'lessons');
      if(!fs.existsSync(dir))return [];
      return fs.readdirSync(dir)
        .filter(name=>/^thc-enc-\d{3,}\.json$/.test(name))
        .map(name=>path.posix.join('content','encyclopedia',volume,'lessons',name));
    });
  }

  const explicit=process.env.ENCYCLOPEDIA_CHANGED_FILES;
  if(explicit){
    return explicit.split(/[\n,]/).map(x=>x.trim()).filter(Boolean);
  }

  try{
    if(process.env.GITHUB_BASE_REF){
      const base='origin/'+process.env.GITHUB_BASE_REF;
      return git(['diff','--name-only',base+'...HEAD']).split('\n').filter(Boolean);
    }
    return git(['diff','--name-only','HEAD^','HEAD']).split('\n').filter(Boolean);
  }catch(error){
    console.error('Unable to determine changed lesson files. Use --all or ENCYCLOPEDIA_CHANGED_FILES.');
    console.error(String(error?.message||error));
    process.exit(1);
  }
}

const changed=[...new Set(changedFiles().filter(file=>canonicalPattern.test(file)))].sort();
if(!changed.length){
  console.log('Encyclopedia changed-depth gate: no canonical lesson files changed.');
  process.exit(0);
}

const failures=[];
const report=[];

for(const file of changed){
  const full=path.join(root,file);
  if(!fs.existsSync(full)){
    failures.push(file+': canonical lesson file was removed or is unavailable');
    continue;
  }
  const lesson=JSON.parse(fs.readFileSync(full,'utf8'));
  const metrics={
    coreScienceWords:words(coreScience(lesson)),
    coreScienceTeachingPoints:coreScience(lesson).length,
    cultivationRelevanceWords:words(cultivation(lesson)),
    measurementGuidanceWords:words(measurements(lesson)),
    misconceptionCount:misconceptions(lesson).length,
    evidenceLimitsWords:words(evidenceLimits(lesson)),
    sourceCount:sources(lesson).length
  };
  const misses=[];
  if(metrics.coreScienceWords<targets.coreScienceMinimumWords)misses.push('core science '+metrics.coreScienceWords+'/'+targets.coreScienceMinimumWords+' words');
  if(metrics.coreScienceTeachingPoints<targets.coreScienceMinimumTeachingPoints)misses.push('core science '+metrics.coreScienceTeachingPoints+'/'+targets.coreScienceMinimumTeachingPoints+' teaching points');
  if(metrics.cultivationRelevanceWords<targets.cultivationRelevanceMinimumWords)misses.push('cultivation relevance '+metrics.cultivationRelevanceWords+'/'+targets.cultivationRelevanceMinimumWords+' words');
  if(metrics.measurementGuidanceWords<targets.measurementGuidanceMinimumWords)misses.push('measurement guidance '+metrics.measurementGuidanceWords+'/'+targets.measurementGuidanceMinimumWords+' words');
  if(metrics.misconceptionCount<targets.misconceptionMinimumCount)misses.push('misconceptions '+metrics.misconceptionCount+'/'+targets.misconceptionMinimumCount);
  if(metrics.evidenceLimitsWords<targets.evidenceLimitsMinimumWords)misses.push('evidence limits '+metrics.evidenceLimitsWords+'/'+targets.evidenceLimitsMinimumWords+' words');
  if(metrics.sourceCount<targets.sourceMinimumCount)misses.push('sources '+metrics.sourceCount+'/'+targets.sourceMinimumCount);

  const justification=String(lesson.depthReview?.shorterThanDefaultJustification||'').trim();
  const justified=misses.length>0&&Boolean(q.depthOverrideRequiresJustification)&&justification.length>=80;
  report.push({id:lesson.id,file,metrics,misses,justified});

  if(misses.length&&!justified){
    failures.push(lesson.id+': '+misses.join('; '));
  }
}

console.log('Encyclopedia changed-depth gate');
for(const row of report){
  const state=row.misses.length?(row.justified?'JUSTIFIED':'FAIL'):'PASS';
  console.log(`${state} ${row.id}: core=${row.metrics.coreScienceWords}w/${row.metrics.coreScienceTeachingPoints}pts; cultivation=${row.metrics.cultivationRelevanceWords}w; measurement=${row.metrics.measurementGuidanceWords}w; misconceptions=${row.metrics.misconceptionCount}; limits=${row.metrics.evidenceLimitsWords}w; sources=${row.metrics.sourceCount}`);
}

if(failures.length){
  console.error('\nChanged canonical encyclopedia lessons failed the scientific-depth gate:');
  failures.forEach(x=>console.error(' - '+x));
  console.error('Repair the lesson or add a substantive >=80 character depthReview.shorterThanDefaultJustification when the topic genuinely requires a shorter treatment.');
  process.exit(1);
}

console.log(`Changed-depth gate PASS: ${changed.length} canonical lesson(s) meet the production depth standard.`);
