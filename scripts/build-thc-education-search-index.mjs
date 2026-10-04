import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const out=path.join(root,'site/public-route-patch/learn/search/search-index.json');
const docs=new Map();
const routeOwners=new Map();
const idPriorities=new Map();

const clean=(v)=>String(v??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const add=(row,priority=20)=>{
  if(!row?.id||!row?.title||!row?.route)return;
  const id=String(row.id);
  const route=String(row.route);
  const existingIdPriority=idPriorities.get(id)??-Infinity;
  if(existingIdPriority>priority)return;

  const previous=docs.get(id);
  if(previous){
    const previousOwner=routeOwners.get(previous.route);
    if(previousOwner?.id===id)routeOwners.delete(previous.route);
  }

  const routeOwner=routeOwners.get(route);
  if(routeOwner&&routeOwner.id!==id){
    if(routeOwner.priority>priority){
      if(previous)routeOwners.set(previous.route,{id,priority:existingIdPriority});
      return;
    }
    docs.delete(routeOwner.id);
    idPriorities.delete(routeOwner.id);
  }

  docs.set(id,{
    id,
    type:clean(row.type||'Reference'),
    title:clean(row.title),
    route,
    summary:clean(row.summary||''),
    keywords:[...new Set((row.keywords||[]).map(clean).filter(Boolean))].slice(0,48),
    terms:(row.terms||[]).map(clean).filter(Boolean),
    synonyms:(row.synonyms||[]).map(clean).filter(Boolean),
    aliases:(row.aliases||[]).map(clean).filter(Boolean),
    objective:clean(row.objective||''),
    measurements:(row.measurements||[]).map(clean).filter(Boolean),
    misconceptions:(row.misconceptions||[]).map(clean).filter(Boolean),
    coreScience:(row.coreScience||[]).map(clean).filter(Boolean),
    cultivation:(row.cultivation||[]).map(clean).filter(Boolean),
    tools:(row.tools||[]).map(clean).filter(Boolean),
    evidence:{
      claimCount:Number(row.evidence?.claimCount||0),
      claimTypes:(row.evidence?.claimTypes||[]).map(clean).filter(Boolean),
      sourceIds:(row.evidence?.sourceIds||[]).map(clean).filter(Boolean),
      sourceTitles:(row.evidence?.sourceTitles||[]).map(clean).filter(Boolean),
      reviewState:clean(row.evidence?.reviewState||'')
    },
    program:clean(row.program||''),
    status:clean(row.status||''),
    sourceRepository:clean(row.sourceRepository||''),
    sourceRef:clean(row.sourceRef||'')
  });
  routeOwners.set(route,{id,priority});
  idPriorities.set(id,priority);
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

const curated=readJson('configuration/education-search-static-records.json');
for(const item of curated?.documents||[]) add(item,30);

const nav=readJson('data/public-navigation.json');
for(const item of nav?.learn?.sections||[]) add({id:'learn-'+item.route.replace(/\W+/g,'-'),type:'Learning',title:item.label,route:item.route,summary:'Teaching Healthy Cultivation learning resource.',keywords:[item.label]},10);
for(const item of nav?.courses?.sections||[]) add({id:'course-'+item.route.replace(/\W+/g,'-'),type:'Courses',title:item.label,route:item.route,summary:'Structured THC course or learning pathway.',keywords:['course','academy',item.label]},10);
for(const item of nav?.tools||[]) if(item.public) add({id:'tool-'+item.id,type:'Tool',title:item.title,route:item.route,summary:'Public THC cultivation reference or workflow tool.',keywords:[item.id,item.title]},10);

const courseCatalog=readJson('site/wordpress/education/course-catalog-v4.json');
const publicCourseManifests=[
  readJson('site/wordpress/education/tech1-courses-public-v1.json'),
  readJson('site/wordpress/education/tech2-courses-public-v1.json')
].filter(Boolean);
const catalogCourseById=new Map((courseCatalog?.courses||[]).map(course=>[String(course.id),course]));

for(const manifest of publicCourseManifests){
  const program=manifest?.program||{};
  const baseRoute=String(program.route||'').replace(/\/$/,'');
  for(const courseRef of manifest?.courses||[]){
    const catalogCourse=catalogCourseById.get(String(courseRef.id))||{};
    const route=(catalogCourse.href||((baseRoute&&courseRef.slug)?baseRoute+'/'+courseRef.slug+'/':''));
    if(!route)continue;
    add({
      id:courseRef.id,
      type:'Courses',
      title:catalogCourse.title||String(courseRef.slug||courseRef.id).replace(/-/g,' '),
      route,
      summary:catalogCourse.summary||('Public academic course in '+(program.title||'THC Academy')+'.'),
      keywords:[
        'course','academy','certification training',program.title,program.slug,
        catalogCourse.pathLabel,catalogCourse.statusLabel,courseRef.id,courseRef.releaseId
      ],
      program:program.title||'',
      status:'public-academic',
      sourceRepository:manifest.source?.repository||'',
      sourceRef:manifest.source?.ref||''
    },50);
  }
}

for(const course of courseCatalog?.courses||[]){
  if(!course?.id||!course?.href||course.publicLessonReleaseAvailable!==true)continue;
  add({
    id:course.id,
    type:'Courses',
    title:course.title,
    route:course.href,
    summary:course.summary||'Public THC Academy academic course.',
    keywords:['course','academy',course.pathLabel,course.statusLabel,course.id],
    program:course.pathLabel||'',
    status:'public-academic',
    sourceRepository:'dtfgenetics/Thc-learning-courses-',
    sourceRef:readJson('site/wordpress/education/academy-deployment-target.json')?.sourceSha||''
  },50);
}


const encyclopedia=readJson('site/public-route-patch/learn/encyclopedia/encyclopedia-index.json');
for(const item of encyclopedia?.lessons||[]){
  add({
    id:item.id,
    type:'Encyclopedia',
    title:item.title,
    route:item.route,
    summary:item.objective||(item.status==='published'
      ? ((item.topic||'Encyclopedia')+' · '+(item.primaryFormat||'Reference'))
      : ((item.topic||'Encyclopedia')+' · catalogued; full lesson in review')),
    keywords:[
      ...(item.keywords||[]),
      ...(item.terms||[]),
      ...(item.synonyms||[]),
      ...(item.measurements||[]),
      ...(item.misconceptions||[]),
      ...(item.aliases||[]),
      ...(item.tools||[]),
      item.topic,item.primaryFormat,item.status
    ].map(clean).filter(Boolean),
    terms:item.terms||[],
    synonyms:item.synonyms||[],
    aliases:item.aliases||[],
    objective:item.objective||'',
    measurements:item.measurements||[],
    misconceptions:item.misconceptions||[],
    coreScience:item.coreScience||[],
    cultivation:item.cultivation||[],
    tools:item.tools||[],
    evidence:item.evidence||{}
  },50);
}

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
  },40);
}

const terpenes=readJson('site/public-route-patch/terpene-atlas/data/terpene-catalog-v1.json');
for(const x of Array.isArray(terpenes)?terpenes:(terpenes?.compounds||terpenes?.terpenes||[])){
  const id=x.id||x.slug||x.name;
  if(!id||!x.name)continue;
  add({
    id:'terpene-'+id,
    type:'Terpene Atlas',
    title:x.name,
    route:`/terpene-atlas/?compound=${encodeURIComponent(id)}`,
    summary:x.notes||x.summary||'Terpene chemistry and occurrence reference.',
    keywords:[...(x.aliases||[]),...(x.sensoryDescriptors||x.aroma||[]),x.class,x.formula]
  },40);
}

const documents=[...docs.values()].sort((a,b)=>a.type.localeCompare(b.type)||a.title.localeCompare(b.title));
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify({schemaVersion:3,generated:new Date().toISOString(),documents},null,2)+'\n');

const escapeHtml=(value)=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));

function replaceGeneratedBlock(rel,startMarker,endMarker,body){
  const file=path.join(root,rel);
  const source=fs.readFileSync(file,'utf8');
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker);
  if(start<0||end<0||end<start)throw new Error('Missing generated fallback markers in '+rel);
  const next=source.slice(0,start+startMarker.length)+'\n'+body.trim()+'\n'+source.slice(end);
  fs.writeFileSync(file,next);
}

const searchFallbackDocuments=documents
  .filter(item=>item.type!=='Encyclopedia')
  .slice(0,96);
const searchFallback=searchFallbackDocuments.length
  ? '<section class="static-fallback" data-static-search-fallback aria-label="Education resource fallback"><div class="section-head"><h2>Browse education resources</h2><p>This server-rendered directory remains available if interactive search cannot start.</p></div><div class="grid">'+searchFallbackDocuments.map(item=>
      '<article class="search-card"><div class="search-meta"><span>'+escapeHtml(item.type)+'</span><code>'+escapeHtml(item.id)+'</code></div><h2><a href="'+escapeHtml(item.route)+'">'+escapeHtml(item.title)+'</a></h2><p>'+escapeHtml(item.summary||'Teaching Healthy Cultivation resource.')+'</p><a class="open-link" href="'+escapeHtml(item.route)+'">Open resource →</a></article>'
    ).join('')+'</div></section>'
  : '<section class="static-fallback" data-static-search-fallback><p>Browse the <a href="/learn/">Learning Center</a>, <a href="/learn/encyclopedia/">Encyclopedia</a>, and <a href="/tools/">Cultivation Tools</a>.</p></section>';
replaceGeneratedBlock(
  'site/public-route-patch/learn/search/index.html',
  '<!-- DTF_STATIC_SEARCH_FALLBACK_START -->',
  '<!-- DTF_STATIC_SEARCH_FALLBACK_END -->',
  searchFallback
);

const fallbackLessons=(encyclopedia?.lessons||[]);
const encyclopediaFallback='<section class="static-fallback" data-static-encyclopedia-fallback aria-label="Encyclopedia fallback directory"><div class="section-head"><div><p class="eyebrow" style="color:#8b6f26">Static directory</p><h2>Browse all registered encyclopedia topics</h2></div><p>This canonical directory remains readable if interactive filtering cannot start.</p></div><div class="library">'+fallbackLessons.map(item=>{
  const published=item.status==='published';
  const summary=item.objective||('Reference topic in '+(item.topic||'THC plant science')+'.');
  return '<article class="lesson"><div class="lesson-top"><span class="id">'+escapeHtml(item.id)+'</span><span class="badge '+(published?'':'review')+'">'+(published?'Published':'In review')+'</span></div><h3>'+escapeHtml(item.title)+'</h3><p>'+escapeHtml(summary)+'</p><div class="meta"><span>'+escapeHtml(item.topic||'Encyclopedia')+'</span><span>'+escapeHtml(item.primaryFormat||'Reference')+'</span></div>'+(published?'<a href="'+escapeHtml(item.route)+'">Open lesson →</a>':'<span class="disabled">Registered · full lesson not yet released</span>')+'</article>';
}).join('')+'</div></section>';
replaceGeneratedBlock(
  'site/public-route-patch/learn/encyclopedia/index.html',
  '<!-- DTF_STATIC_ENCYCLOPEDIA_FALLBACK_START -->',
  '<!-- DTF_STATIC_ENCYCLOPEDIA_FALLBACK_END -->',
  encyclopediaFallback
);

console.log(`THC education search index: ${documents.length} documents -> ${path.relative(root,out)}`);
const fallback=spawnSync(process.execPath,[path.join(root,'scripts/build-static-search-fallbacks.mjs')],{stdio:'inherit'});
if(fallback.status!==0)process.exit(fallback.status||1);
