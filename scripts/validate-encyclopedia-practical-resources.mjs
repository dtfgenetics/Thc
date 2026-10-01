import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const encRoot=path.join(root,'content','encyclopedia');
const registryPath=path.join(encRoot,'downloads','registry.json');
const errors=[];
const warnings=[];

const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const arr=v=>Array.isArray(v)?v:[];

if(!fs.existsSync(registryPath)){
  console.error('Missing encyclopedia practical-resource registry.');
  process.exit(1);
}

const registry=readJson(registryPath);
const resources=arr(registry.resources);
const byId=new Map();

for(const resource of resources){
  if(!resource.resourceId) errors.push('Resource is missing resourceId.');
  else if(byId.has(resource.resourceId)) errors.push(`Duplicate resourceId: ${resource.resourceId}`);
  else byId.set(resource.resourceId,resource);

  if(!resource.path) errors.push(`${resource.resourceId||'unknown'} is missing path.`);
  if(!arr(resource.lessonIds).length) errors.push(`${resource.resourceId||'unknown'} has no lessonIds.`);
  if(resource.publicationAuthorized===true && resource.status!=='approved') errors.push(`${resource.resourceId}: publicationAuthorized=true requires status=approved.`);
  else {
    const file=path.join(root,resource.path);
    if(!fs.existsSync(file)) errors.push(`${resource.resourceId}: missing file ${resource.path}`);
    else {
      const data=readJson(file);
      if(data.resourceId!==resource.resourceId) errors.push(`${resource.resourceId}: file resourceId mismatch.`);
      if(data.reviewControl?.publicationAuthorized===true && resource.publicationAuthorized!==true){
        errors.push(`${resource.resourceId}: file is publication-authorized but registry is not.`);
      }
    }
  }
}

function walk(dir){
  if(!fs.existsSync(dir)) return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(file);
    else if(entry.isFile() && /^thc-enc-\d+\.json$/i.test(entry.name)){
      const lesson=readJson(file);
      for(const link of arr(lesson.practicalResources)){
        if(!link.resourceId) errors.push(`${lesson.id}: practical resource is missing resourceId.`);
        else if(!byId.has(link.resourceId)) errors.push(`${lesson.id}: unknown practical resource ${link.resourceId}.`);
        else {
          const resource=byId.get(link.resourceId);
          if(link.path && link.path!==resource.path) errors.push(`${lesson.id}: ${link.resourceId} path differs from registry.`);
          if(!arr(resource.lessonIds).includes(lesson.id)) errors.push(`${lesson.id}: ${link.resourceId} does not list this lesson in registry lessonIds.`);
          if(link.status && link.status!==resource.status) errors.push(`${lesson.id}: ${link.resourceId} status differs from registry.`);
        }
      }
    }
  }
}
walk(encRoot);

for(const resource of resources){
  for(const lessonId of arr(resource.lessonIds)){
    let found=false;
    const number=Number(String(lessonId).match(/\d+/)?.[0]||0);
    if(number>0){
      const volume=String(Math.ceil(number/20)).padStart(2,'0');
      const file=path.join(encRoot,`volume-${volume}`,'lessons',`thc-enc-${String(number).padStart(3,'0')}.json`);
      if(fs.existsSync(file)){
        const lesson=readJson(file);
        found=arr(lesson.practicalResources).some(x=>x.resourceId===resource.resourceId);
      }
    }
    if(!found) errors.push(`${resource.resourceId}: expected lesson link missing from ${lessonId}.`);
  }
}

if(warnings.length){
  console.warn(`Encyclopedia practical-resource warnings: ${warnings.length}`);
  for(const warning of warnings) console.warn(`- ${warning}`);
}
if(errors.length){
  console.error(`Encyclopedia practical-resource errors: ${errors.length}`);
  for(const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Encyclopedia practical resources: ${resources.length} registered · validation passed`);
