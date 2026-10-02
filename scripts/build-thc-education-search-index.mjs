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
    program:clean(row.program||''),
    status:clean(row.status||''),
    sourceRepository:clean(row.sourceRepository||''),
    sourceRef:clean(row.sourceRef||'')
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
    });
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
  });
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
    tools:item.tools||[]
  });
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
  });
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
  });
}

const existing=readJson('site/public-route-patch/learn/search/search-index.json');
for(const x of existing?.documents||[]) if(!docs.has(String(x.id))) add(x);

const documents=[...docs.values()].sort((a,b)=>a.type.localeCompare(b.type)||a.title.localeCompare(b.title));
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify({schemaVersion:2,generated:new Date().toISOString(),documents},null,2)+'\n');
console.log(`THC education search index: ${documents.length} documents -> ${path.relative(root,out)}`);
