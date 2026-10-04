#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const batchArg=process.argv.find(x=>/^\d+$/.test(x))||process.env.ENCYCLOPEDIA_VISUAL_BATCH||'1';
const batchNo=String(Number(batchArg)).padStart(3,'0');
const packetPath=path.join(root,'content','encyclopedia','visual-production-batches',`batch-${batchNo}.json`);
const outDir=path.join(root,'build','encyclopedia-visual-candidates',`batch-${batchNo}`);
if(!fs.existsSync(packetPath)) throw new Error(`Production packet not found: ${packetPath}`);
const packet=JSON.parse(fs.readFileSync(packetPath,'utf8'));
fs.rmSync(outDir,{recursive:true,force:true});
fs.mkdirSync(outDir,{recursive:true});

const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&apos;");
const clean=v=>String(v??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const wrap=(value,max=54,limit=3)=>{
  const words=clean(value).split(' ').filter(Boolean), lines=[]; let line='';
  for(const word of words){
    const next=line?`${line} ${word}`:word;
    if(next.length>max&&line){lines.push(line);line=word;}else line=next;
    if(lines.length>=limit) break;
  }
  if(lines.length<limit&&line) lines.push(line);
  if(words.join(' ').length>lines.join(' ').length&&lines.length) lines[lines.length-1]=lines[lines.length-1].replace(/[.…]*$/,'')+'…';
  return lines.slice(0,limit);
};
const text=(lines,x,y,dy=30,cls='body')=>lines.map((line,i)=>`<text class="${cls}" x="${x}" y="${y+i*dy}">${esc(line)}</text>`).join('\n');
const stepLabels={
  'diagnostic-decision-tree':['Observe','Compare evidence','Confirm'],
  'mechanism-process-diagram':['Mechanism','Measure','Interpret'],
  'measurement-workflow':['Measure','Record','Verify'],
  'comparison-matrix':['Compare','Control context','Conclude'],
  'labeled-structure-diagram':['Locate','Label','Relate'],
  'genetics-pedigree-diagram':['Track','Compare','Interpret'],
  'environment-response-chart':['Measure','Plot response','Interpret'],
  'postharvest-process-diagram':['Process','Monitor','Verify']
};

function svgFor(item){
  const steps=stepLabels[item.visualFamily]||['Observe','Measure','Interpret'];
  const labels=(item.requiredLabels||[]).slice(0,6);
  const accuracy=(item.accuracyRequirements||[]).slice(0,3);
  const guards=(item.misconceptionGuards||[]).slice(0,2);
  const sources=(item.sourceAnchors||[]).slice(0,3);
  const title=wrap(item.title,46,2);
  const purpose=wrap(item.purpose,82,2);
  const sourceText=wrap(sources.join(' · '),108,2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200" viewBox="0 0 1800 1200" role="img" aria-labelledby="title desc">
<title id="title">${esc(item.lessonId+' — '+item.title)}</title>
<desc id="desc">${esc(item.altTextDraft)}</desc>
<style>
.bg{fill:#f6f3e9}.top{fill:#103821}.panel{fill:#fff;stroke:#d6dfd7;stroke-width:2}.soft{fill:#e9f0e9}.warn{fill:#fff4de;stroke:#e2c98d;stroke-width:2}.gold{fill:#d6b85f}.title{font:700 42px Arial,sans-serif;fill:#14301f}.k{font:700 18px Arial,sans-serif;letter-spacing:1.5px;fill:#6c765f}.body{font:500 22px Arial,sans-serif;fill:#30483a}.small{font:500 18px Arial,sans-serif;fill:#52665a}.step{font:700 24px Arial,sans-serif;fill:#14301f}.white{font:700 22px Arial,sans-serif;fill:#fff}.label{font:700 19px Arial,sans-serif;fill:#14301f}
</style>
<rect class="bg" width="1800" height="1200"/>
<rect class="top" width="1800" height="92"/>
<text class="white" x="70" y="58">${esc(item.lessonId)} · Teaching Healthy Cultivation · REVIEW CANDIDATE</text>
<rect class="gold" x="1510" y="26" width="220" height="40" rx="20"/><text class="white" x="1550" y="54">DTF Genetics</text>
<text class="k" x="70" y="145">${esc(String(item.visualFamily).toUpperCase())} · PRIORITY ${esc(item.visualPriorityScore)}</text>
${text(title,70,198,48,'title')}
${text(purpose,70,310,34,'body')}
<text class="k" x="70" y="410">CONTROLLED FLOW</text>
${steps.map((s,i)=>{const x=70+i*555;return `<rect class="panel" x="${x}" y="440" width="510" height="155" rx="20"/><circle class="top" cx="${x+48}" cy="485" r="25"/><text class="white" x="${x+40}" y="493">${i+1}</text><text class="step" x="${x+88}" y="494">${esc(s)}</text>${text(wrap(accuracy[i]||accuracy[0]||item.purpose,45,2),x+35,545,27,'small')}`;}).join('\n')}
<text class="k" x="70" y="670">REQUIRED LABELS</text>
${labels.map((label,i)=>{const col=i%3,row=Math.floor(i/3);const x=70+col*555,y=700+row*76;return `<rect class="soft" x="${x}" y="${y}" width="510" height="58" rx="16"/><text class="label" x="${x+22}" y="${y+36}">${esc(wrap(label,38,1)[0]||label)}</text>`;}).join('\n')}
<rect class="warn" x="70" y="885" width="1660" height="155" rx="20"/>
<text class="k" x="100" y="925">MISCONCEPTION GUARDS</text>
${text(wrap(guards.join(' · ')||'Do not imply a universal target where the lesson defines context-dependent interpretation.',115,3),100,966,28,'body')}
<text class="k" x="70" y="1095">SOURCE ANCHORS</text>
${text(sourceText,70,1132,25,'small')}
<text class="small" x="1390" y="1170">STAGING ONLY · NOT PUBLICATION APPROVED</text>
</svg>`;
}

const manifest={schemaVersion:1,batchId:packet.batchId,generatedFrom:path.relative(root,packetPath),candidateState:'staging-review-candidate',publicationEffect:'none',items:[]};
for(const item of packet.items||[]){
  const name=`${item.lessonId}_review-candidate-v1.svg`;
  fs.writeFileSync(path.join(outDir,name),svgFor(item));
  manifest.items.push({lessonId:item.lessonId,svg:name,targetProduction:item.targetRepositoryPath,requiredReviews:item.requiredReviews});
}
fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Built ${manifest.items.length} staging SVG review candidates for ${packet.batchId} in ${path.relative(root,outDir)}`);
