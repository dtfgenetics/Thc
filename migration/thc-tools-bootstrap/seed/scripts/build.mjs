import fs from 'node:fs';
import path from 'node:path';

const registry=JSON.parse(fs.readFileSync('data/tool-registry.json','utf8'));
const dist=path.resolve('dist');
fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(dist,{recursive:true});

for(const tool of registry.tools){
  const source=path.join('apps',tool.slug);
  const target=path.join(dist,tool.slug);
  if(!fs.existsSync(source)) throw new Error('missing app source: '+source);
  fs.cpSync(source,target,{recursive:true});
}

if(fs.existsSync('public/assets')){
  fs.cpSync('public/assets',path.join(dist,'assets'),{recursive:true});
}

console.log(`Built ${registry.tools.length} THC tool routes into ${dist}`);
