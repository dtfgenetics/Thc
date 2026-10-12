import fs from 'node:fs';
import path from 'node:path';
const canonical='/tmp/tools/site/public-route-patch/atlas';
const mirror='site/public-route-patch/atlas';
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
}
if(!inspected)throw Error('No existing Atlas lesson pages were checked');
if(losses.length)throw Error('Atlas preservation failed:\n'+losses.join('\n'));
console.log('Atlas preservation checked '+inspected+' existing lessons');
