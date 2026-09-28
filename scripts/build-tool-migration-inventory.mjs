import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,'data/tool-registry.json'),'utf8'));
const apps=JSON.parse(fs.readFileSync(path.join(root,'site/deployment/public-apps.json'),'utf8'));
const nav=JSON.parse(fs.readFileSync(path.join(root,'data/public-navigation.json'),'utf8'));
const appByRoute=new Map((apps.apps||[]).map(x=>[x.route,x]));
const navTools=[...(nav.tools||[]),...((nav.diagnostic&&nav.diagnostic.tools)||[])];
const navByRoute=new Map(navTools.map(x=>[x.route,x]));

const lines=[
  '# THC Tools Migration Inventory',
  '',
  'Generated from `data/tool-registry.json`. Do not hand-maintain route coverage in this file.',
  '',
  '| Route | Source | Registry status | Deployment | Navigation | GrowLens | Required assets |',
  '|---|---|---|---|---|---|---|'
];
for(const tool of registry.tools){
  const route='/'+tool.slug+'/';
  const app=appByRoute.get(route);
  const navItem=navByRoute.get(route);
  lines.push('| '+route+' | `'+tool.sourcePath+'` | '+(tool.public?'public':'development')+' | '+(app?(app.status||'registered'):'MISSING')+' | '+(navItem?((navItem.public?'public':'non-public')+' / '+(navItem.status||'unknown')):'MISSING')+' | '+(tool.growlensBridge?'yes':'no')+' | '+((tool.requiredAssets||[]).length?tool.requiredAssets.map(x=>'`'+x+'`').join('<br>'):'—')+' |');
}
lines.push('', '## Shared runtime', '');
for(const asset of registry.sharedAssets||[])lines.push('- `'+asset+'`');
lines.push('', '## Coverage notes', '', '- Local validation must iterate this registry.', '- Live verification must iterate only entries with `public: true`.', '- Development entries may exist in source and deployment manifests but must not be presented as verified live routes until promoted.');
process.stdout.write(lines.join('\n')+'\n');
