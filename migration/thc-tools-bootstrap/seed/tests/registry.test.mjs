import fs from 'node:fs';

const registry=JSON.parse(fs.readFileSync('data/tool-registry.json','utf8'));
const expected=23;
const slugs=registry.tools.map(tool=>tool.slug);
const unique=new Set(slugs);

if(registry.canonicalRepository!=='dtfgenetics/thc-tools') throw new Error('canonical repository mismatch');
if(registry.tools.length!==expected) throw new Error(`expected ${expected} tool routes, found ${registry.tools.length}`);
if(unique.size!==slugs.length) throw new Error('duplicate tool slugs');
for(const slug of ['tools','atlas','terpene-atlas','ipm-scout','grow-planner','breeder-pedigree']){
  if(!unique.has(slug)) throw new Error('missing route: '+slug);
}
console.log(`Registry test passed for ${registry.tools.length} routes.`);
