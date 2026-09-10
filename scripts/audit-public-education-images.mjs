import { access, readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const root='site/wordpress/education';
const assetRoot='site/wordpress/assets/infographics';
const exclusions=JSON.parse(await readFile(`${assetRoot}/infographic-exclusions.json`,'utf8'));
const fragments=Array.isArray(exclusions.excludePathFragments)?exclusions.excludePathFragments:[];
const allowed=new Set(Array.isArray(exclusions.allowedExceptions)?exclusions.allowedExceptions:[]);
const rejectedBasenames=new Set([
  'THC-C008_Infographic_Flower_Anatomy_Reproduction',
  'THC-C009_Infographic_Trichomes_Secretory_Biology'
]);

const rasterBase=v=>String(v||'').replace(/\.(png|jpe?g|webp)$/i,'');
const isRejected=file=>{
  const value=String(file||'');
  if(allowed.has(value)) return false;
  return rejectedBasenames.has(rasterBase(basename(value))) ||
    fragments.some(fragment=>value.includes(fragment)) ||
    /(?:^|[\/_-])(draft|quarantine|superseded|qa[-_ ]?required)(?:[\/_-]|$)/i.test(value);
};

function collectFiles(value,out=[]){
  if(Array.isArray(value)){for(const item of value) collectFiles(item,out);return out;}
  if(!value||typeof value!=='object') return out;
  for(const [key,item] of Object.entries(value)){
    if((key==='file'||key==='path'||key==='src')&&typeof item==='string'&&/\.(png|jpe?g|webp)$/i.test(item)) out.push(item);
    else collectFiles(item,out);
  }
  return out;
}

const entries=await readdir(root,{withFileTypes:true});
const maps=entries.filter(e=>e.isFile()&&/(?:visual-map|chapter-visuals).*\.json$/i.test(e.name)).map(e=>join(root,e.name)).sort();
const errors=[];
let checked=0;
for(const mapPath of maps){
  let doc;
  try{doc=JSON.parse(await readFile(mapPath,'utf8'));}catch(error){errors.push(`${mapPath}: invalid JSON (${error.message})`);continue;}
  const files=collectFiles(doc);
  for(const file of files){
    checked+=1;
    if(isRejected(file)){errors.push(`${mapPath}: excluded public visual reference -> ${file}`);continue;}
    const candidate=file.startsWith('site/')?file:join(assetRoot,file);
    try{await access(candidate);}catch{errors.push(`${mapPath}: missing canonical visual -> ${file}`);}
  }
}

const curated='site/public-route-patch/assets/education/infographics/import-curated-2026-08-19.json';
try{
  const doc=JSON.parse(await readFile(curated,'utf8'));
  for(const item of doc.assets||[]){
    const file=String(item.path||'');
    checked+=1;
    if(isRejected(file)) errors.push(`${curated}: excluded import -> ${file}`);
    try{await access(file);}catch{errors.push(`${curated}: missing import source -> ${file}`);}
  }
}catch(error){errors.push(`${curated}: ${error.message}`);}

if(errors.length){
  console.error(`Public education image audit failed with ${errors.length} issue(s):`);
  for(const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Public education image audit passed: ${maps.length} visual maps/chapter maps, ${checked} image references checked, 0 excluded or missing assets.`);
