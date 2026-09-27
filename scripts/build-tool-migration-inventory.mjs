import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,'data/tool-registry.json'),'utf8'));
const apps=JSON.parse(fs.readFileSync(path.join(root,'site/deployment/public-apps.json'),'utf8'));
const nav=JSON.parse(fs.readFileSync(path.join(root,'data/public-navigation.json'),'utf8'));

const appIds=new Set((apps.apps||[]).map(item=>item.id));
const navIds=new Set((nav.tools||[]).map(item=>item.id));

const lines=[
  '# THC Tools Migration Inventory',
  '',
  'Generated from `data/tool-registry.json` plus current deployment/navigation manifests.',
  '',
  '| Tool | Public route | Source | Deployment | Navigation | GrowLens | Required assets |',
  '| --- | --- | --- | --- | --- | --- | --- |'
];

for(const tool of registry.tools){
  const sourceExists=fs.existsSync(path.join(root,tool.sourcePath));
  const aliases=(tool.sourceAliases||[]).map(alias=>`${fs.existsSync(path.join(root,alias))?'✓':'MISSING'} \`${alias}\``).join('<br>');
  const sourceLabel=`${sourceExists?'✓':'MISSING'} \`${tool.sourcePath}\`${aliases?'<br>'+aliases:''}`;
  const deployment=tool.deploymentId===null?'site route':(appIds.has(tool.deploymentId)?`✓ \`${tool.deploymentId}\``:`MISSING \`${tool.deploymentId}\``);
  const navigation=tool.navigationId===null?'root route':(navIds.has(tool.navigationId)?`✓ \`${tool.navigationId}\``:`MISSING \`${tool.navigationId}\``);
  const assetStatus=tool.requiredAssets.length
    ? tool.requiredAssets.map(asset=>fs.existsSync(path.join(root,asset))?'✓':'MISSING').join(' ')
    : 'route-local / none declared';
  lines.push(`| ${tool.title} | /${tool.slug}/ | ${sourceLabel} | ${deployment} | ${navigation} | ${tool.growlensBridge?'yes':'no'} | ${assetStatus} |`);
}

lines.push('','## Shared runtime ownership','');
const shared=[...new Set(registry.tools.flatMap(tool=>tool.requiredAssets))].sort();
for(const asset of shared){
  lines.push(`- ${fs.existsSync(path.join(root,asset))?'✓':'MISSING'} \`${asset}\``);
}

lines.push('','## Coverage checks','');
for(const slug of ['ipm-scout','grow-planner','breeder-pedigree']){
  lines.push(`- ${registry.tools.some(tool=>tool.slug===slug)?'✓':'MISSING'} \`${slug}\` is registry-owned`);
}

process.stdout.write(lines.join('\n')+'\n');
