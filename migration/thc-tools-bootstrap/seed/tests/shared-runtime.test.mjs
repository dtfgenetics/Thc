import fs from 'node:fs';
import path from 'node:path';

const registry=JSON.parse(fs.readFileSync('data/tool-registry.json','utf8'));
const assets=[...new Set(registry.tools.flatMap(tool=>tool.requiredAssets))];

for(const sourcePath of assets){
  const rel=sourcePath.replace(/^site\/public-route-patch\//,'');
  const target=path.join('public',rel);
  if(!fs.existsSync(target)) throw new Error('missing shared runtime asset: '+target);
}
console.log(`Shared runtime test passed for ${assets.length} declared assets.`);
