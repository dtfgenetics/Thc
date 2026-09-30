import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const strict=process.argv.includes('--strict');
const encRoot=path.join(root,'content','encyclopedia');
const registryPath=path.join(encRoot,'current-controlled-registry.json');
const outPath=path.join(root,'data','encyclopedia-learning-quality-audit.json');

const readJson=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return null}};
const arr=v=>Array.isArray(v)?v:[];
const txt=v=>String(v??'').trim();
const registry=readJson(registryPath);
if(!registry?.entries?.length) throw new Error('Missing controlled encyclopedia registry.');

const lessons=new Map();
function walk(dir){
  if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())walk(file);
    else if(entry.isFile()&&entry.name.endsWith('.json')){
      const json=readJson(file);
      if(!json)continue;
      if(/^THC-ENC-\d{3,}$/.test(json.id||'')) lessons.set(json.id,{...json,_file:path.relative(root,file)});
      for(const lesson of arr(json.lessons)){
        if(/^THC-ENC-\d{3,}$/.test(lesson?.id||'')) lessons.set(lesson.id,{...lesson,_file:path.relative(root,file)});
      }
    }
  }
}
walk(encRoot);

const termsOf=l=>arr(l.terms).length?arr(l.terms):arr(l.termsToKnow);
const measuresOf=l=>arr(l.measureAndRecord).length?arr(l.measureAndRecord):arr(l.measurements);
const checksOf=l=>arr(l.knowledgeCheck).length?arr(l.knowledgeCheck):arr(l.courseLayer?.knowledgeCheck);
const sourcesOf=l=>arr(l.sourceNotes).length?arr(l.sourceNotes):arr(l.evidence);
const visualsOf=l=>arr(l.visuals);
const crossOf=l=>{
  if(typeof l.crossLinks==='string') return l.crossLinks.match(/THC-ENC-\d{3}/g)||[];
  if(Array.isArray(l.crossLinks)) return l.crossLinks;
  if(l.crossLinks&&typeof l.crossLinks==='object') return [
    ...arr(l.crossLinks.prerequisiteLessonIds),
    ...arr(l.crossLinks.relatedLessonIds),
    ...arr(l.crossLinks.toolIds),
    ...arr(l.crossLinks.sopIds),
    ...arr(l.crossLinks.downloadIds)
  ];
  return [];
};
const misconceptionRows=l=>arr(l.misconceptions);
const pairedMisconceptionCount=l=>misconceptionRows(l).filter(x=>{
  if(x&&typeof x==='object')return Boolean(txt(x.claim||x.misconception)&&txt(x.correction||x.explanation));
  const s=txt(x);return s.includes(':')&&txt(s.slice(s.indexOf(':')+1)).length>=12;
}).length;
const rationaleComplete=l=>{
  const status=txt(l.assessmentDesign?.answerRationaleStatus);
  if(status&&!/pending|missing|todo|draft/i.test(status))return true;
  const rationales=arr(l.assessmentDesign?.answerRationales);
  return checksOf(l).length>=3&&rationales.length>=checksOf(l).length;
};
const approvedVisual=l=>visualsOf(l).some(v=>v?.assetId&&v?.qaStatus==='approved')||Boolean(l.approvedVisualAssetId);
const sourceCopyIssue=l=>sourcesOf(l).some(s=>/Open sourc(?:e|ee)?\b|sourcee\b/i.test(txt(s)));
const placeholderIssue=l=>misconceptionRows(l).some(x=>/see the (controlled )?lesson evidence and context/i.test(typeof x==='string'?x:JSON.stringify(x)));

const rows=registry.entries.map(entry=>{
  const l=lessons.get(entry.id);
  const exists=Boolean(l);
  const misconceptionCount=exists?misconceptionRows(l).length:0;
  const checkCount=exists?checksOf(l).length:0;
  const individualCanonical=Boolean(l?._file?.includes('/lessons/'));
  const publicationAuthorized=Boolean(l?.reviewControl?.publicationAuthorized??l?.publicationAuthorized??false);
  const record={
    id:entry.id,number:entry.number,part:entry.part,title:entry.title,
    exists,sourceFile:l?._file||null,individualCanonical,publicationAuthorized,
    objective:Boolean(txt(l?.objective||arr(l?.learningObjectives)[0]).length>=24),
    terms:termsOf(l||{}).length,
    coreScience:arr(l?.coreScience).length,
    measurements:measuresOf(l||{}).length,
    misconceptions:misconceptionCount,
    pairedMisconceptions:exists?pairedMisconceptionCount(l):0,
    crossLinks:crossOf(l||{}).length,
    sources:sourcesOf(l||{}).length,
    approvedVisual:exists?approvedVisual(l):false,
    assessmentChecks:checkCount,
    assessmentComplete:checkCount>=3,
    rationaleComplete:exists?rationaleComplete(l):false,
    sourceCopyIssue:exists?sourceCopyIssue(l):false,
    placeholderIssue:exists?placeholderIssue(l):false
  };
  record.complete=Boolean(
    record.exists&&record.objective&&record.terms>=3&&record.coreScience>=2&&record.measurements>=2&&
    record.misconceptions>=2&&record.pairedMisconceptions>=2&&record.crossLinks>=2&&record.sources>=2&&
    record.approvedVisual&&record.assessmentComplete&&record.rationaleComplete&&!record.sourceCopyIssue&&!record.placeholderIssue
  );
  return record;
});

const count=key=>rows.filter(r=>r[key]).length;
const summary={
  controlled:rows.length,
  represented:count('exists'),
  individualCanonical:count('individualCanonical'),
  publicationAuthorized:count('publicationAuthorized'),
  visualComplete:count('approvedVisual'),
  assessmentComplete:count('assessmentComplete'),
  rationaleComplete:count('rationaleComplete'),
  fullyComplete:count('complete'),
  sourceCopyIssues:count('sourceCopyIssue'),
  placeholderIssues:count('placeholderIssue')
};
const byPart=[...new Set(rows.map(r=>r.part))].sort((a,b)=>a-b).map(part=>{
  const partRows=rows.filter(r=>r.part===part);
  const c=k=>partRows.filter(r=>r[k]).length;
  return {part,count:partRows.length,represented:c('exists'),individualCanonical:c('individualCanonical'),visualComplete:c('approvedVisual'),assessmentComplete:c('assessmentComplete'),rationaleComplete:c('rationaleComplete'),fullyComplete:c('complete')};
});
const output={
  schemaVersion:1,
  generatedAt:new Date().toISOString(),
  scope:'THC Cannabis Plant Science Encyclopedia only. Academy/course membership is intentionally not an encyclopedia completion criterion.',
  summary,byPart,lessons:rows
};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');

console.log('Encyclopedia learning quality audit');
console.log(JSON.stringify(summary,null,2));

const hardErrors=[];
if(rows.length<420)hardErrors.push('Controlled registry contains fewer than 420 lessons.');
if(summary.represented!==rows.length)hardErrors.push('Not every controlled lesson is represented in source.');
if(summary.sourceCopyIssues)hardErrors.push(summary.sourceCopyIssues+' lesson(s) contain malformed source-copy labels.');
if(summary.placeholderIssues)hardErrors.push(summary.placeholderIssues+' lesson(s) contain generic misconception placeholder text.');
if(strict){
  if(summary.individualCanonical!==rows.length)hardErrors.push((rows.length-summary.individualCanonical)+' lesson(s) are not individual canonical files.');
  if(summary.visualComplete!==rows.length)hardErrors.push((rows.length-summary.visualComplete)+' lesson(s) lack an approved teaching visual.');
  if(summary.assessmentComplete!==rows.length)hardErrors.push((rows.length-summary.assessmentComplete)+' lesson(s) lack three lesson-specific checks.');
  if(summary.rationaleComplete!==rows.length)hardErrors.push((rows.length-summary.rationaleComplete)+' lesson(s) lack complete assessment rationale.');
}
if(hardErrors.length){
  for(const e of hardErrors)console.error('ERROR: '+e);
  process.exit(1);
}
