import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const registryPath=path.join(root,'data/tool-registry.json');
const errors=[];
const ok=(value,message)=>{if(!value)errors.push(message)};

ok(fs.existsSync(registryPath),'data/tool-registry.json must exist');
if(!fs.existsSync(registryPath)){console.error(errors.join('\n'));process.exit(1)}
const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
const expected=['tools','atlas','terpene-atlas','ph-meter','tds-meter','vpd-chart','ppfd-chart','water-quality-lab','fertigation-lab','dryback-lab','dew-point','environment-control','ipm-scout','dry-cure-lab','grow-planner','substrate-calculator','breeder-pedigree','co2-ventilation','photoperiod-planner','plant-growth-tracker','root-zone-temperature','dilution-calculator','unit-converter'];
const tools=Array.isArray(registry.tools)?registry.tools:[];
ok(tools.length===expected.length,`expected ${expected.length} tool registry entries, found ${tools.length}`);
const slugs=tools.map(x=>x.slug);
for(const slug of expected)ok(slugs.filter(x=>x===slug).length===1,`registry must contain ${slug} exactly once`);
ok(new Set(slugs).size===slugs.length,'registry contains duplicate slugs');
ok(new Set(tools.map(x=>x.id)).size===tools.length,'registry contains duplicate ids');

for(const tool of tools){
  ok(typeof tool.title==='string'&&tool.title.trim(),tool.slug+' title missing');
  ok(typeof tool.category==='string'&&tool.category.trim(),tool.slug+' category missing');
  ok(typeof tool.public==='boolean',tool.slug+' public flag missing');
  ok(typeof tool.sourcePath==='string'&&tool.sourcePath.trim(),tool.slug+' sourcePath missing');
  const entry=path.join(root,tool.sourcePath,'index.html');
  ok(fs.existsSync(entry),tool.slug+' index.html missing at '+entry);
  ok(Array.isArray(tool.validationMarkers)&&tool.validationMarkers.length>0,tool.slug+' validationMarkers missing');
  if(tool.public)ok(Array.isArray(tool.liveMarkers)&&tool.liveMarkers.length>0,tool.slug+' liveMarkers missing');
  for(const asset of tool.requiredAssets||[])ok(fs.existsSync(path.join(root,asset)),tool.slug+' required asset missing: '+asset);
}
for(const asset of registry.sharedAssets||[])ok(fs.existsSync(path.join(root,asset)),'shared registry asset missing: '+asset);
for(const slug of ['ipm-scout','grow-planner','breeder-pedigree'])ok(slugs.includes(slug),'required migration route missing: '+slug);

if(errors.length){console.error('Tool registry test failed with '+errors.length+' issue(s):');for(const error of errors)console.error(' - '+error);process.exit(1)}
console.log('Tool registry test passed: '+tools.length+' canonical routes are registered with source paths, markers, status and dependencies.');
