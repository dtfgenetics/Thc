import fs from 'node:fs';

const shared=fs.readFileSync('site/public-route-patch/assets/thc-tool-suite-v1.js','utf8');
const growth=fs.readFileSync('site/public-route-patch/plant-growth-tracker/index.html','utf8');
const root=fs.readFileSync('site/public-route-patch/root-zone-temperature/index.html','utf8');
const errors=[];
const ok=(v,m)=>{if(!v)errors.push(m)};

for(const token of [
  'addDiaryEntry:(input)=>',
  "type:'note'",
  'plantId:r.plantId',
  'cycleId:r.cycleId',
  "title:title.slice(0,180)",
  "notes:String(input?.notes||'').slice(0,4000)",
  'createdAt:input?.createdAt||new Date().toISOString()'
]) ok(shared.includes(token),'shared GrowLens diary bridge missing: '+token);

for(const [slug,html,tokens] of [
  ['plant-growth-tracker',growth,['id="saveGrowthGrowLens"','THC.growlens.addDiaryEntry','Plant growth measurement','nodes/day']],
  ['root-zone-temperature',root,['id="saveRootGrowLens"','THC.growlens.addDiaryEntry','Root-zone temperature measurement','root-air Δ']]
]){
  for(const token of tokens) ok(html.includes(token),slug+' missing GrowLens diary integration token: '+token);
}

if(errors.length){
  console.error('GrowLens tool diary bridge validation failed:');
  for(const error of errors) console.error(' - '+error);
  process.exit(1);
}
console.log('GrowLens diary bridges validated for Plant Growth and Root-Zone Temperature tools.');
