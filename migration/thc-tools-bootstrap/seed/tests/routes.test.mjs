import fs from 'node:fs';
import path from 'node:path';

const registry=JSON.parse(fs.readFileSync('data/tool-registry.json','utf8'));

for(const tool of registry.tools){
  const root=path.join('apps',tool.slug);
  const entry=path.join(root,'index.html');
  if(!fs.existsSync(entry)) throw new Error(`${tool.slug}: missing index.html`);
  const html=fs.readFileSync(entry,'utf8');
  for(const marker of tool.validationMarkers){
    if(!html.includes(marker)) throw new Error(`${tool.slug}: missing validation marker: ${marker}`);
  }
}
console.log(`Route test passed for ${registry.tools.length} routes.`);
