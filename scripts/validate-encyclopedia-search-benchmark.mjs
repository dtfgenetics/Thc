import fs from 'node:fs';
import Fuse from '../site/public-route-patch/assets/vendor/fuse-7.1.0.min.mjs';
import {explainSearchMatch} from '../site/public-route-patch/learn/search/thc-search-explain-v1.mjs';

const benchmark=JSON.parse(fs.readFileSync('configuration/encyclopedia-search-benchmark.json','utf8'));
const discovery=JSON.parse(fs.readFileSync('site/public-route-patch/learn/encyclopedia/encyclopedia-index.json','utf8'));
const lessons=Array.isArray(discovery.lessons)?discovery.lessons:[];
const runtimeSource=fs.readFileSync('site/public-route-patch/learn/encyclopedia/encyclopedia-v1.mjs','utf8');
const maxDefault=Number(benchmark.defaultMaxRank||10);
const fuseOptions={
  includeScore:true,
  shouldSort:true,
  ignoreLocation:true,
  threshold:.3,
  minMatchCharLength:2,
  keys:[
    {name:'title',weight:.26},
    {name:'id',weight:.12},
    {name:'terms',weight:.12},
    {name:'synonyms',weight:.08},
    {name:'aliases',weight:.10},
    {name:'objective',weight:.09},
    {name:'topic',weight:.07},
    {name:'measurements',weight:.06},
    {name:'misconceptions',weight:.05},
    {name:'coreScience',weight:.05},
    {name:'cultivation',weight:.04},
    {name:'tools',weight:.025},
    {name:'evidence.sourceTitles',weight:.035},
    {name:'evidence.claimTypes',weight:.02},
    {name:'keywords',weight:.025}
  ]
};
const fuse=new Fuse(lessons,fuseOptions);

const failures=[];
// Fail if the production and benchmark search configurations diverge.
const benchmarkKeys=fuseOptions.keys.map(k=>({name:k.name,weight:k.weight}));
const runtimeKeys=[...runtimeSource.matchAll(/\{name:'([^']+)',weight:([0-9.]+)\}/g)].map(m=>({name:m[1],weight:Number(m[2])}));
if(JSON.stringify(benchmarkKeys)!==JSON.stringify(runtimeKeys)) failures.push('Search benchmark Fuse keys/weights differ from production runtime');
for(const token of ['threshold:.3','minMatchCharLength:2','ignoreLocation:true','shouldSort:true']) if(!runtimeSource.includes(token)) failures.push('Production search settings changed: '+token);
const rows=[];
const seenQueries=new Set();
const availableParts=new Set(lessons.map(x=>Number(x.part)).filter(Number.isInteger));
if(!Number.isInteger(maxDefault) || maxDefault < 1 || maxDefault > 100) failures.push('defaultMaxRank must be an integer from 1 to 100');
for(const [i, test] of (benchmark.cases||[]).entries()){
  const query=typeof test?.query==='string' ? test.query.trim() : '';
  const normalized=query.toLowerCase().split(/\s+/).join(' ');
  if(!query) failures.push('case '+i+': empty query');
  if(seenQueries.has(normalized)) failures.push('case '+i+': duplicate query '+query);
  seenQueries.add(normalized);
  if(!Array.isArray(test?.expectedParts) || !test.expectedParts.length || test.expectedParts.some(p=>!Number.isInteger(p) || !availableParts.has(p))) failures.push('case '+i+': expectedParts must reference existing subject parts');
  if(test?.expectedIds!==undefined && (!Array.isArray(test.expectedIds) || !test.expectedIds.length || test.expectedIds.some(id=>typeof id!=='string'||!lessons.some(l=>l.id===id)))) failures.push('case '+i+': expectedIds must reference existing lesson IDs');
  if(test?.maxRank!==undefined && (!Number.isInteger(test.maxRank) || test.maxRank<1 || test.maxRank>100)) failures.push('case '+i+': invalid maxRank');
}
if(failures.length){console.error(['Invalid benchmark configuration:',...failures].join(String.fromCharCode(10)));process.exit(1);}

for(const test of benchmark.cases||[]){
  const maxRank=Number(test.maxRank||maxDefault);
  const results=fuse.search(test.query,{limit:maxRank}).map((row,index)=>({...row.item,rank:index+1,score:row.score}));
  const hit=results.find(x=>(test.expectedParts||[]).includes(Number(x.part)));
  const explained=results[0]?explainSearchMatch(results[0],test.query):null;
  const expectedIds=Array.isArray(test.expectedIds)?test.expectedIds:[];
  const judgmentStatus=test.judgmentStatus||'unreviewed';
  const exactHit=expectedIds.length?results.find(x=>expectedIds.includes(x.id)):null;
  const exactRank=exactHit?.rank ?? null;
  const top1Relevant=Boolean(results[0]&&(test.expectedParts||[]).includes(Number(results[0].part)));
  const top3Relevant=results.slice(0,3).some(x=>(test.expectedParts||[]).includes(Number(x.part)));
  rows.push({
    query:test.query,
    passed:Boolean(hit&&explained&&(!expectedIds.length||exactHit)),
    top1Relevant, top3Relevant,
    firstRelevantRank:hit?.rank ?? null,
    exactRank, judgmentStatus,
    hit:hit?{id:hit.id,part:hit.part,rank:hit.rank,title:hit.title}:null,
    top:results[0]?{id:results[0].id,part:results[0].part,score:results[0].score,title:results[0].title}:null,
    explanation:explained
  });
  if(expectedIds.length && !exactHit)failures.push(`${test.query}: expected lesson ID absent from top ${maxRank}`);
  if(!hit)failures.push(`${test.query}: no expected subject part [${(test.expectedParts||[]).join(', ')}] in top ${maxRank}`);
  if(results[0]&&!explained)failures.push(`${test.query}: top result had no match explanation`);
}
const passed=rows.filter(x=>x.passed).length;
const top1Count=rows.filter(x=>x.top1Relevant).length;
const top3Count=rows.filter(x=>x.top3Relevant).length;
const reciprocalRank=rows.reduce((sum,x)=>sum+(x.firstRelevantRank?1/x.firstRelevantRank:0),0)/(rows.length||1);
const exactCases=rows.filter(x=>x.judgmentStatus!=='unreviewed');
const exactTop3=exactCases.filter(x=>x.exactRank<=3).length;
const independentlyReviewed=exactCases.filter(x=>x.judgmentStatus==='independently-reviewed').length;
const absentExact=exactCases.filter(x=>x.exactRank===null);
for(const row of absentExact) console.error(`MISSING_EXACT_LESSON: ${row.query}`);
if(!independentlyReviewed) console.warn('LESSON_RELEVANCE_UNVERIFIED: exact lesson judgments remain provisional; independent review missing.');
const weakQueries=rows.filter(x=>!x.top3Relevant).map(x=>({query:x.query,firstRelevantRank:x.firstRelevantRank,top:x.top}));
console.log(`Exact lesson ranking: ${exactTop3}/${exactCases.length} provisional/curated ID cases in top 3; independently reviewed cases: ${independentlyReviewed}.`);
console.log(`Encyclopedia search benchmark: ${passed}/${rows.length} recall cases passed; top-1 subject relevance ${top1Count}/${rows.length}; top-3 subject relevance ${top3Count}/${rows.length}; mean reciprocal subject rank ${reciprocalRank.toFixed(3)}.`);
if (!rows.length) failures.push('Benchmark contains no queries');
for(const row of weakQueries) console.warn(`WEAK_RANKING: ${row.query}; first relevant rank: ${row.firstRelevantRank ?? 'not found'}; top result: ${row.top?.id||'-'}`);
if(process.env.GITHUB_STEP_SUMMARY){
 const summary=['## Encyclopedia subject search relevance',`- Recall@${maxDefault}: ${passed}/${rows.length}`,`- Top-1: ${top1Count}/${rows.length}`,`- Top-3: ${top3Count}/${rows.length}`,`- MRR (subject-level): ${reciprocalRank.toFixed(3)}`,'','### Weak queries',...weakQueries.map(x=>`- ${x.query}: first relevant rank ${x.firstRelevantRank??'not found'}`),''].join(String.fromCharCode(10));
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
}
for(const row of rows)console.log(`${row.passed?'PASS':'FAIL'}\t${row.query}\t${row.hit?.id||'-'}\tpart ${row.hit?.part||'-'}\trank ${row.hit?.rank||'-'}`);
if(failures.length){
  console.error('Search benchmark failures:');
  failures.forEach(x=>console.error(' - '+x));
  process.exit(1);
}
