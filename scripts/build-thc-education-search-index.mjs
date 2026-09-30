import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'site/public-route-patch/learn/search/search-index.json');
const docs=new Map();

const clean=(v)=>String(v??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const add=(row)=>{
  if(!row?.id||!row?.title||!row?.route)return;
  docs.set(String(row.id),{
    id:String(row.id),
    type:clean(row.type||'Reference'),
    title:clean(row.title),
    route:String(row.route),
    summary:clean(row.summary||''),
    keywords:[...new Set((row.keywords||[]).map(clean).filter(Boolean))].slice(0,24)
  });
};

function readJson(rel){
  const p=path.join(root,rel);
  if(!fs.existsSync(p))return null;
  try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}
}
function walk(dir,cb){
  if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory())walk(p,cb); else cb(p);
  }
}

const nav=readJson('data/public-navigation.json');
for(const item of nav?.learn?.sections||[]) add({id:'learn-'+item.route.replace(/\W+/g,'-'),type:'Learning',title:item.label,route:item.route,summary:'Teaching Healthy Cultivation learning resource.',keywords:[item.label]});
for(const item of nav?.courses?.sections||[]) add({id:'course-'+item.route.replace(/\W+/g,'-'),type:'Courses',title:item.label,route:item.route,summary:'Structured THC course or learning pathway.',keywords:['course','academy',item.label]});
for(const item of nav?.tools||[]) if(item.public) add({id:'tool-'+item.id,type:'Tool',title:item.title,route:item.route,summary:'Public THC cultivation reference or workflow tool.',keywords:[item.id,item.title]});

const controlledRegistry=readJson('content/encyclopedia/current-controlled-registry.json');
const encyclopediaTopics=readJson('configuration/encyclopedia-topics.json');
const topicByPart=new Map((encyclopediaTopics?.topics||[]).map(topic=>[Number(topic.part),topic]));
const slugify=(value)=>String(value??'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

for(const entry of controlledRegistry?.entries||[]){
  const topic=topicByPart.get(Number(entry.part));
  const published=Number(entry.number)<=335;
  add({
    id:entry.id,
    type:'Encyclopedia',
    title:entry.title,
    route:published
      ? `/encyclopedia/${slugify(entry.title)}/`
      : `/learn/encyclopedia/?lesson=${encodeURIComponent(entry.id)}`,
    summary:(topic?.title||`Part ${entry.part}`)+' · '+(entry.primaryFormat||'Reference')+(published?'':' · catalogued; full lesson in review'),
    keywords:[topic?.title,entry.primaryFormat,entry.teachingVisual,entry.id,published?'published':'in review'].filter(Boolean)
  });
}

walk(path.join(root,'content/encyclopedia'),file=>{
  if(!file.endsWith('.json'))return;
  let x;try{x=JSON.parse(fs.readFileSync(file,'utf8'))}catch{return}
  if(!x?.id||!x?.title)return;
  const existing=docs.get(String(x.id));
  if(existing){
    const terms=[
      ...(Array.isArray(x.terms)?x.terms.map(t=>t?.term):[]),
      ...(Array.isArray(x.termsToKnow)?x.termsToKnow:[]),
      ...(Array.isArray(x.cultivationRelevance)?x.cultivationRelevance.slice(0,2):[])
    ];
    docs.set(String(x.id),{
      ...existing,
      summary:clean(x.objective||(Array.isArray(x.coreScience)?x.coreScience[0]:existing.summary)),
      keywords:[...new Set([...(existing.keywords||[]),...terms.map(clean).filter(Boolean)])].slice(0,24)
    });
    return;
  }
  const slug=x.slug||String(x.id).toLowerCase();
  add({
    id:x.id,
    type:'Encyclopedia',
    title:x.title,
    route:`/encyclopedia/${slug}/`,
    summary:x.objective||(Array.isArray(x.coreScience)?x.coreScience[0]:''),
    keywords:[...(x.terms||[]).map(t=>t?.term),...(x.cultivationRelevance||[]).slice(0,2),x.id]
  });
});

const systems=readJson('site/public-route-patch/atlas/data/systems.json');
for(const x of Array.isArray(systems)?systems:(systems?.systems||[])){
  if(!x?.id&&!x?.title)continue;
  const id=x.id||String(x.title).toLowerCase().replace(/[^a-z0-9]+/g,'-');
  add({
    id:'atlas-'+id,
    type:'Atlas',
    title:x.title||x.name||id,
    route:x.route||`/atlas/${id}/`,
    summary:x.summary||x.description||'Cannabis plant anatomy and systems reference.',
    keywords:[...(x.keywords||[]),...(x.structures||[]).map(v=>typeof v==='string'?v:v?.name)]
  });
}

const terpenes=readJson('site/public-route-patch/terpene-atlas/data/terpene-catalog-v1.json');
for(const x of Array.isArray(terpenes)?terpenes:(terpenes?.compounds||terpenes?.terpenes||[])){
  const id=x.id||x.slug||x.name;
  if(!id||!x.name)return;
  add({
    id:'terpene-'+id,
    type:'Terpene Atlas',
    title:x.name,
    route:`/terpene-atlas/?compound=${encodeURIComponent(id)}`,
    summary:x.notes||x.summary||'Terpene chemistry and occurrence reference.',
    keywords:[...(x.aliases||[]),...(x.sensoryDescriptors||x.aroma||[]),x.class,x.formula]
  });
}

const existing=readJson('site/public-route-patch/learn/search/search-index.json');
for(const x of existing?.documents||[]) if(!docs.has(String(x.id))) add(x);

const documents=[...docs.values()].sort((a,b)=>a.type.localeCompare(b.type)||a.title.localeCompare(b.title));
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify({schemaVersion:2,generated:new Date().toISOString(),documents},null,2)+'\n');
console.log(`THC education search index: ${documents.length} documents -> ${path.relative(root,out)}`);
