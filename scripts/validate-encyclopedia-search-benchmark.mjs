import fs from 'node:fs';
import Fuse from '../site/public-route-patch/assets/vendor/fuse-7.1.0.min.mjs';
import {explainSearchMatch} from '../site/public-route-patch/learn/search/thc-search-explain-v1.mjs';

const benchmark=JSON.parse(fs.readFileSync('configuration/encyclopedia-search-benchmark.json','utf8'));
const discovery=JSON.parse(fs.readFileSync('site/public-route-patch/learn/encyclopedia/encyclopedia-index.json','utf8'));
const lessons=Array.isArray(discovery.lessons)?discovery.lessons:[];
const maxDefault=Number(benchmark.defaultMaxRank||10);
const fuse=new Fuse(lessons,{
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
    {name:'keywords',weight:.025}
  ]
});

const failures=[];
const rows=[];
for(const test of benchmark.cases||[]){
  const maxRank=Number(test.maxRank||maxDefault);
  const results=fuse.search(test.query,{limit:maxRank}).map((row,index)=>({...row.item,rank:index+1,score:row.score}));
  const hit=results.find(x=>(test.expectedParts||[]).includes(Number(x.part)));
  const explained=results[0]?explainSearchMatch(results[0],test.query):null;
  rows.push({
    query:test.query,
    passed:Boolean(hit&&explained),
    hit:hit?{id:hit.id,part:hit.part,rank:hit.rank,title:hit.title}:null,
    top:results[0]?{id:results[0].id,part:results[0].part,score:results[0].score,title:results[0].title}:null,
    explanation:explained
  });
  if(!hit)failures.push(`${test.query}: no expected subject part [${(test.expectedParts||[]).join(', ')}] in top ${maxRank}`);
  if(results[0]&&!explained)failures.push(`${test.query}: top result had no match explanation`);
}
const passed=rows.filter(x=>x.passed).length;
console.log(`Encyclopedia search benchmark: ${passed}/${rows.length} cases passed.`);
for(const row of rows)console.log(`${row.passed?'PASS':'FAIL'}\t${row.query}\t${row.hit?.id||'-'}\tpart ${row.hit?.part||'-'}\trank ${row.hit?.rank||'-'}`);
if(failures.length){
  console.error('Search benchmark failures:');
  failures.forEach(x=>console.error(' - '+x));
  process.exit(1);
}
