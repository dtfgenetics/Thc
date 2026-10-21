import fs from 'node:fs';
import path from 'node:path';
const canonical=process.env.DTF_ATLAS_CANONICAL_DIR || '/tmp/tools/site/public-route-patch/atlas';
const mirror=process.env.DTF_ATLAS_MIRROR_DIR || 'site/public-route-patch/atlas';
let inspected=0;
const losses=[];
function* pages(dir,relative='') {
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const next=path.join(relative,entry.name);
  if(entry.isSymbolicLink()) throw Error('Symlink in Atlas mirror: '+next);
  if(entry.isDirectory()) yield* pages(path.join(dir,entry.name),next);
  else if(entry.isFile()&&entry.name==='index.html'&&relative) yield next;
 }
}
for(const root of [canonical,mirror]) {
 const stat=fs.lstatSync(root,{throwIfNoEntry:false});
 if(!stat?.isDirectory()||stat.isSymbolicLink()) throw Error('Missing or unsafe Atlas directory: '+root);
}
const visible=html=>html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().length;
// Preserve canonical route identity and approved instructional graphics.
const canonicalPath=html=>{
 const tags=html.match(/<link\b[^>]*>/gi)||[];
 let found=null;
 for(const tag of tags){
  const rel=tag.match(/\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if(!rel||!(rel[1]||rel[2]||rel[3]).split(/\s+/).some(x=>x.toLowerCase()==='canonical'))continue;
  const href=tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if(!href)return null;
  try {
   const url=new URL(href[1]||href[2]||href[3], 'https://dtfseeds.com');
   if(!['dtfseeds.com','www.dtfseeds.com'].includes(url.hostname.toLowerCase()))return null;
   if(!['https:','http:'].includes(url.protocol)||url.port||url.username||url.password)return null;
   if(found!==null)return null;
   found=url.pathname.replace(/\/+$/,'')||'/';
  }catch{return null;}
 }
 return found;
};
const instructionalSvgCount=html=>(html.match(/<svg\b[^>]*>/gi)||[])
 .filter(tag=>/\brole\s*=\s*(?:"img"|'img')/i.test(tag)).length;

for(const relative of pages(mirror)){
 inspected++;
 let current=canonical;
 let safe=true;
 for(const part of relative.split(path.sep)){
  current=path.join(current,part);
  const stat=fs.lstatSync(current,{throwIfNoEntry:false});
  if(!stat){safe=false;break;}
  if(stat.isSymbolicLink())throw Error('Symlink in canonical Atlas: '+relative);
 }
 if(!safe||!fs.statSync(current).isFile()){losses.push(relative+': missing canonical lesson');continue;}
 const old=fs.readFileSync(path.join(mirror,relative),'utf8');
 const incoming=fs.readFileSync(current,'utf8');
 const before=visible(old),after=visible(incoming);
 if(before>=600&&after<before*.7)losses.push(relative+': visible text '+before+' -> '+after);
 const oldRoute=canonicalPath(old),newRoute=canonicalPath(incoming);
 if(oldRoute&&oldRoute!==newRoute)losses.push(relative+': canonical route '+oldRoute+' -> '+(newRoute||'missing or off-site'));
 const oldVisuals=instructionalSvgCount(old),newVisuals=instructionalSvgCount(incoming);
 if(newVisuals<oldVisuals)losses.push(relative+': instructional SVG count '+oldVisuals+' -> '+newVisuals);
}
if(!inspected)throw Error('No existing Atlas lesson pages were checked');
if(losses.length)throw Error('Atlas preservation failed:\n'+losses.join('\n'));
console.log('Atlas preservation checked '+inspected+' existing lessons');
