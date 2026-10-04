#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';

const root=process.cwd();
const renderPng=process.argv.includes('--render-png');
const allowGeneratedRaster=renderPng;
const assetRoot=path.join(root,'site','wordpress','assets','infographics');
const mapPath=path.join(root,'site','wordpress','education','encyclopedia','all-visual-map-v1.json');
fs.mkdirSync(assetRoot,{recursive:true});
fs.mkdirSync(path.dirname(mapPath),{recursive:true});

const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&apos;");
const clean=v=>String(v??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const arr=v=>Array.isArray(v)?v.filter(Boolean):[];
const term=v=>typeof v==='string'?v:(v?.term||v?.name||v?.label||'');
const wrap=(value,max=58,lines=3)=>{
  const words=clean(value).split(' ').filter(Boolean);
  const out=[]; let line='';
  for(const word of words){
    const next=line?line+' '+word:word;
    if(next.length>max&&line){out.push(line);line=word;}else line=next;
    if(out.length>=lines)break;
  }
  if(out.length<lines&&line)out.push(line);
  if(words.join(' ').length>out.join(' ').length&&out.length)out[out.length-1]=out[out.length-1].replace(/[.…]*$/,'')+'…';
  return out.slice(0,lines);
};
const textLines=(lines,x,y,dy=30,cls='body')=>lines.map((line,i)=>`<text class="${cls}" x="${x}" y="${y+i*dy}">${esc(line)}</text>`).join('\n');
function existingRasterFor(id){
  const names=fs.readdirSync(assetRoot).filter(name=>new RegExp('^'+id+'(?:_|\\b)','i').test(name)&&/\\.(?:png|jpe?g|webp)$/i.test(name)).sort();
  return names[0]||null;
}
function svgFor(lesson){
  const terms=(arr(lesson.terms).length?arr(lesson.terms):arr(lesson.termsToKnow)).map(term).filter(Boolean).slice(0,4);
  while(terms.length<4)terms.push(['Observe','Measure','Compare','Verify'][terms.length]);
  const science=arr(lesson.coreScience).slice(0,3).map(clean);
  while(science.length<3)science.push('Use the lesson evidence and measurement context to verify this relationship.');
  const misconceptions=arr(lesson.misconceptions).map(x=>typeof x==='string'?x:(x?.claim||x?.misconception||'')).filter(Boolean);
  const objective=clean(lesson.objective||arr(lesson.learningObjectives)[0]||'Understand the controlled lesson mechanism and how to verify it.');
  const title=clean(lesson.title);
  const visual=clean(lesson.requiredTeachingVisual||'Concept diagram');
  const id=lesson.id;
  const objectiveLines=wrap(objective,88,2);
  const titleLines=wrap(title,54,2);
  const sciLines=science.map(s=>wrap(s,63,2));
  const guard=wrap(misconceptions[0]||'Do not turn a context-dependent relationship into a universal cultivation target.',88,2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-labelledby="title desc">
<title id="title">${esc(id+' — '+title)}</title>
<desc id="desc">${esc(visual+' teaching visual. '+objective)}</desc>
<style>
  .bg{fill:#f7f4ec}.panel{fill:#ffffff;stroke:#d6ddd5;stroke-width:2}.accent{fill:#173f35}.soft{fill:#e7efe9}.gold{fill:#d6b35c}.title{font:700 38px Arial,sans-serif;fill:#153a31}.id{font:700 22px Arial,sans-serif;fill:#ffffff}.kicker{font:700 18px Arial,sans-serif;letter-spacing:1.6px;fill:#557066}.body{font:500 22px Arial,sans-serif;fill:#263b35}.small{font:500 18px Arial,sans-serif;fill:#49635a}.term{font:700 20px Arial,sans-serif;fill:#153a31}.step{font:700 23px Arial,sans-serif;fill:#153a31}.guard{font:600 20px Arial,sans-serif;fill:#5a3b22}
</style>
<rect class="bg" width="1600" height="1000"/>
<rect class="accent" x="0" y="0" width="1600" height="86"/>
<text class="id" x="70" y="55">${esc(id)} · Teaching Healthy Cultivation</text>
<rect class="gold" x="1370" y="25" rx="18" width="160" height="38"/><text class="id" x="1400" y="52">DTF Genetics</text>
<text class="kicker" x="70" y="135">${esc(visual.toUpperCase())}</text>
${textLines(titleLines,70,184,45,'title')}
${textLines(objectiveLines,70,278,34,'body')}
<text class="kicker" x="70" y="365">CONTROLLED TERMS</text>
${terms.map((t,i)=>`<rect class="soft" x="${70+i*365}" y="390" width="335" height="78" rx="18"/><text class="term" x="${95+i*365}" y="438">${esc(wrap(t,24,1)[0])}</text>`).join('\n')}
<text class="kicker" x="70" y="535">MECHANISM → MEASUREMENT → INTERPRETATION</text>
${sciLines.map((lines,i)=>{const x=70+i*505;return `<rect class="panel" x="${x}" y="565" width="470" height="200" rx="20"/><circle class="accent" cx="${x+42}" cy="610" r="25"/><text class="id" x="${x+34}" y="618">${i+1}</text>${textLines(lines,x+35,665,32,'small')}`;}).join('\n')}
<path d="M540 665 H575" stroke="#d6b35c" stroke-width="8" stroke-linecap="round"/><path d="M1045 665 H1080" stroke="#d6b35c" stroke-width="8" stroke-linecap="round"/>
<rect x="70" y="805" width="1460" height="120" rx="20" fill="#fff5e6" stroke="#e6c98c" stroke-width="2"/>
<text class="kicker" x="100" y="842">MISCONCEPTION GUARD</text>
${textLines(guard,100,880,29,'guard')}
<text class="small" x="70" y="970">Review state: generated teaching candidate — verify scientific accuracy, accessibility, and context before approval.</text>
</svg>`;
}

const lessons=readCanonicalEncyclopediaLessons(root).sort((a,b)=>Number(a.number)-Number(b.number));
if(lessons.length!==420)throw new Error(`Expected 420 canonical lessons, found ${lessons.length}`);
const items=[];
let generated=0,reused=0;
for(const lesson of lessons){
  const existing=existingRasterFor(lesson.id);
  if(existing){
    items.push({id:lesson.id,title:lesson.title,assetPath:existing,assetKind:'existing-canonical-raster',altText:`${lesson.title} — controlled companion teaching visual`});
    reused+=1;
    continue;
  }
  if(!allowGeneratedRaster){
    items.push({id:lesson.id,title:lesson.title,assetPath:null,assetKind:'raster-artwork-needed',altText:`${lesson.title} — lesson-specific raster teaching diagram required`});
    continue;
  }
  const base=`${lesson.id}_generated-teaching-visual-v1`;
  const pngName=base+'.png';
  const tempSvg=path.join(root,'.tmp-'+base+'.svg');
  fs.writeFileSync(tempSvg,svgFor(lesson));
  const result=spawnSync('rsvg-convert',['-w','1800','-h','1125','-o',path.join(assetRoot,pngName),tempSvg],{stdio:'inherit'});
  try{fs.unlinkSync(tempSvg)}catch{}
  if(result.status!==0)throw new Error(`rsvg-convert failed for ${lesson.id}`);
  items.push({id:lesson.id,title:lesson.title,assetPath:pngName,assetKind:'generated-raster-review-pending',altText:`${lesson.title} — lesson-specific teaching diagram showing controlled terms, mechanism, measurement, and misconception guard`});
  generated+=1;
}
const map={schemaVersion:1,batch:'encyclopedia-all-visuals-v1',generatedAt:new Date().toISOString(),reviewState:'generated_candidates_pending_independent_science_accessibility_and_asset_qa',publicationEffect:'none_review_state_unchanged',lessonCount:items.length,reusedCanonicalRaster:reused,generatedCandidates:generated,items};
fs.writeFileSync(mapPath,JSON.stringify(map,null,2)+'\n');
console.log(`Encyclopedia teaching visuals: ${items.length}/420 mapped · ${reused} canonical raster reused · ${generated} generated raster candidate(s) · raster-only policy enforced · renderPng=${renderPng}`);
console.log('Wrote '+path.relative(root,mapPath));
