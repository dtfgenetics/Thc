import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,'content/encyclopedia/current-controlled-registry.json'),'utf8'));
const topics=JSON.parse(fs.readFileSync(path.join(root,'configuration/encyclopedia-topics.json'),'utf8')).topics||[];
const release=JSON.parse(fs.readFileSync(path.join(root,'site/wordpress/education/encyclopedia/current-production-batch.json'),'utf8'));
const searchLanguage=JSON.parse(fs.readFileSync(path.join(root,'configuration/encyclopedia-search-language.json'),'utf8'));
const topicByPart=new Map(topics.map(topic=>[Number(topic.part),topic]));

const clean=v=>String(v??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const arr=v=>Array.isArray(v)?v:[];
const flatten=v=>arr(v).map(x=>{
  if(typeof x==='string')return x;
  if(!x||typeof x!=='object')return '';
  return [x.term,x.definition,x.field,x.requirement,x.name,x.label,x.title,x.text].filter(Boolean).join(' ');
}).map(clean).filter(Boolean);
const slugify=value=>String(value??'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

const lessonById=new Map();
function walk(dir){
  if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())walk(file);
    else if(entry.isFile()&&entry.name.endsWith('.json')){
      let json;try{json=JSON.parse(fs.readFileSync(file,'utf8'))}catch{continue}
      if(/^THC-ENC-\d{3,}$/.test(json?.id||''))lessonById.set(json.id,json);
      for(const lesson of arr(json?.lessons))if(/^THC-ENC-\d{3,}$/.test(lesson?.id||''))lessonById.set(lesson.id,lesson);
    }
  }
}
walk(path.join(root,'content/encyclopedia'));

const releaseNumbers=arr(release.lessonFiles).flatMap(file=>String(file).match(/thc-enc-(\d{3,})/gi)||[]).map(id=>Number(id.match(/\d+/)?.[0]||0));
const publicationCutoff=Math.max(0,...releaseNumbers);

function aliasesFor(entry){
  const part=Number(entry.part);
  return [...new Set((searchLanguage.rules||[])
    .filter(rule=>(arr(rule.targetParts).includes(part)||arr(rule.targetLessonIds).includes(entry.id)))
    .flatMap(rule=>arr(rule.aliases))
    .map(clean)
    .filter(Boolean))];
}

function toolIdsFor(part){
  const ids=new Set(['growlens']);
  if([3,5,7].includes(part)){ids.add('water-quality-lab');ids.add('ph-meter');ids.add('tds-meter')}
  if([5,6].includes(part)){ids.add('vpd-chart');ids.add('ppfd-chart');ids.add('environment-control')}
  if([3,7].includes(part)){ids.add('dryback-lab');ids.add('fertigation-lab');ids.add('root-zone-temperature')}
  if([1,4,10,11,12,14,15,16,17].includes(part))ids.add('atlas');
  if([12,13].includes(part))ids.add('terpene-atlas');
  if([14,15,16,17].includes(part)){ids.add('grow-doc');ids.add('ipm-scout')}
  if(part===18)ids.add('dry-cure-lab');
  if([8,20].includes(part))ids.add('breeder-pedigree');
  if([2,9,10,11,18,19].includes(part))ids.add('grow-planner');
  return [...ids];
}

function searchFields(lesson){
  const terms=arr(lesson.terms).length?lesson.terms:lesson.termsToKnow;
  const measurements=arr(lesson.measureAndRecord).length?lesson.measureAndRecord:lesson.measurements;
  const cross=typeof lesson.crossLinks==='string'?[lesson.crossLinks]:Array.isArray(lesson.crossLinks)?lesson.crossLinks:[];
  const evidence=typeof lesson.evidenceLimits==='string'?[lesson.evidenceLimits]:lesson.evidenceLimits;
  return {
    objective:clean(lesson.objective||arr(lesson.learningObjectives)[0]),
    terms:flatten(terms),
    coreScience:flatten(lesson.coreScience||lesson.sections?.mechanism),
    cultivation:flatten(lesson.cultivationRelevance||lesson.sections?.cultivationRelevance),
    measurements:flatten(measurements||lesson.sections?.measurementAndRecords),
    misconceptions:flatten(lesson.misconceptions||lesson.sections?.misconceptions),
    evidenceLimits:flatten(evidence||lesson.sections?.evidenceLimits),
    crossLinks:flatten(cross),
    synonyms:flatten(lesson.synonyms||lesson.acceptedTerms)
  };
}

const lessons=(registry.entries||[]).map(entry=>{
  const lesson=lessonById.get(entry.id)||{};
  const topic=topicByPart.get(Number(entry.part));
  const fields=searchFields(lesson);
  const published=Number(entry.number)<=publicationCutoff;
  const slug=lesson.slug||slugify(entry.title);
  const tools=toolIdsFor(Number(entry.part));
  const aliases=aliasesFor(entry);
  const publicFields=published?fields:{
    objective:'',
    terms:[],
    coreScience:[],
    cultivation:[],
    measurements:[],
    misconceptions:[],
    evidenceLimits:[],
    crossLinks:[],
    synonyms:[]
  };
  return {
    id:entry.id,
    number:Number(entry.number),
    part:Number(entry.part),
    topic:topic?.title||`Part ${entry.part}`,
    topicSlug:topic?.slug||`part-${entry.part}`,
    title:entry.title,
    primaryFormat:entry.primaryFormat||lesson.primaryFormat||'Reference',
    teachingVisual:entry.teachingVisual||lesson.requiredTeachingVisual||null,
    status:published?'published':'catalogued-review',
    route:published?`/learn/encyclopedia/thc-enc-${String(entry.number).padStart(3,'0')}/`:`/learn/encyclopedia/?lesson=${encodeURIComponent(entry.id)}`,
    tools,
    aliases,
    ...publicFields,
    keywords:[topic?.title,entry.primaryFormat,entry.teachingVisual,entry.id,...(published?fields.terms:[]),...(published?fields.synonyms:[]),...aliases,...tools].map(clean).filter(Boolean)
  };
});

const topicRows=topics.map(topic=>{
  const rows=lessons.filter(x=>x.part===Number(topic.part));
  return {...topic,count:rows.length,publishedCount:rows.filter(x=>x.status==='published').length};
});
const facets={
  topic:Object.fromEntries(topicRows.map(x=>[x.title,x.count])),
  format:Object.fromEntries([...new Set(lessons.map(x=>x.primaryFormat))].sort().map(format=>[format,lessons.filter(x=>x.primaryFormat===format).length])),
  status:Object.fromEntries([...new Set(lessons.map(x=>x.status))].map(status=>[status,lessons.filter(x=>x.status===status).length]))
};
const output={
  schemaVersion:2,
  generatedAt:new Date().toISOString(),
  publicationCutoff,
  lessonCount:lessons.length,
  searchLanguageVersion:Number(searchLanguage.schemaVersion||1),
  note:'Generated from the controlled registry and canonical lesson source. Review-only entries stay discoverable without exposing unreleased lesson bodies.',
  facets,
  topics:topicRows,
  lessons
};
const out=path.join(root,'site/public-route-patch/learn/encyclopedia/encyclopedia-index.json');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');
console.log(`Encyclopedia discovery index: ${lessons.length} lessons · published through ${publicationCutoff} · ${topicRows.length} topics`);
