import fs from 'node:fs';

const registry=JSON.parse(fs.readFileSync('data/tool-registry.json','utf8'));
const base=String(process.env.DTF_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const failures=[];

for(const tool of registry.tools.filter(tool=>tool.public)){
  const response=await fetch(new URL('/'+tool.slug+'/',base),{redirect:'manual',signal:AbortSignal.timeout(20000)});
  const body=await response.text();
  if(response.status!==200) failures.push(`${tool.slug}: HTTP ${response.status}`);
  for(const marker of tool.liveMarkers){
    if(!body.toLowerCase().includes(marker.toLowerCase())) failures.push(`${tool.slug}: missing ${marker}`);
  }
}

if(failures.length){
  for(const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(`Live verification passed for ${registry.tools.filter(tool=>tool.public).length} registry routes.`);
