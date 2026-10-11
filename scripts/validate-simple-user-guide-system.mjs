import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const batchPath=path.join(root,'site/wordpress/education/simple-user-guide-batch1.json');
const visualPath=path.join(root,'site/wordpress/education/simple-user-guide-visuals-v1.json');
const evidencePath=path.join(root,'site/wordpress/education/simple-user-guide-evidence-v1.json');
const batch=JSON.parse(fs.readFileSync(batchPath,'utf8'));
const visuals=JSON.parse(fs.readFileSync(visualPath,'utf8'));
const evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
const errors=[];
const fail=(m)=>errors.push(m);
const expected=['setup','seeds','seedling','veg','flower','harvest','dry','cure','pests','tips'];

if(batch.schemaVersion!==1||batch.id!=='simple-user-guide-batch1') fail('Unexpected Simple User Guide source identity.');
if(batch.visualManifest!=='site/wordpress/education/simple-user-guide-visuals-v1.json') fail('Batch must point to the controlled visual manifest.');
if(batch.evidenceManifest!=='site/wordpress/education/simple-user-guide-evidence-v1.json') fail('Batch must point to the evidence manifest.');
const slugs=(batch.pages||[]).map(x=>x.slug);
if(JSON.stringify(slugs)!==JSON.stringify(expected)) fail('Simple User Guide page order or identity changed.');
if(visuals.schemaVersion!==1||visuals.id!=='simple-user-guide-visuals-v1') fail('Unexpected visual manifest identity.');
if(!Array.isArray(visuals.visuals)||visuals.visuals.length!==10) fail('Visual manifest must define exactly ten page records.');
const visualMap=new Map(visuals.visuals.map(x=>[x.pageSlug,x]));
for(const [i,slug] of expected.entries()){
  const page=batch.pages[i], visual=visualMap.get(slug);
  if(!visual) { fail(`${slug}: missing visual record`); continue; }
  if(visual.pageNumber!==i+1) fail(`${slug}: visual page number mismatch`);
  if(!visuals.statusValues.includes(visual.status)) fail(`${slug}: unsupported visual status ${visual.status}`);
  if(String(visual.altText||'').length<30) fail(`${slug}: useful alt text is required`);
  if(String(visual.caption||'').length<20) fail(`${slug}: useful caption is required`);
  const gates=visual.review||{};
  for(const gate of ['scientificQA','visualQA','accessibilityQA','pagePlacementQA']) if(typeof gates[gate]!=='boolean') fail(`${slug}: review.${gate} must be boolean`);
  if(visual.assetPath){
    const abs=path.join(root,visual.assetPath);
    if(!fs.existsSync(abs)) fail(`${slug}: referenced asset is missing: ${visual.assetPath}`);
    if(visual.format==='png'&&fs.existsSync(abs)){
      const header=fs.readFileSync(abs).subarray(0,24);
      if(header.length<24||!header.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||header.toString('ascii',12,16)!=='IHDR') fail(`${slug}: invalid PNG signature`);
      else {
        const w=header.readUInt32BE(16),h=header.readUInt32BE(20);
        if(w!==visual.widthPx||h!==visual.heightPx) fail(`${slug}: declared dimensions ${visual.widthPx}x${visual.heightPx} do not match ${w}x${h}`);
      }
    }
  } else if(visual.status!=='artwork-needed'&&visual.status!=='rejected') fail(`${slug}: status ${visual.status} requires an assetPath`);
  if(visual.status==='approved'){
    if(!visual.assetPath||!visual.publicUrl) fail(`${slug}: approved visual needs assetPath and publicUrl`);
    if(!Object.values(gates).every(Boolean)) fail(`${slug}: approved visual has incomplete review gates`);
    if(Number(visual.widthPx)<visuals.approvalMinimums.widthPx||Number(visual.heightPx)<visuals.approvalMinimums.heightPx) fail(`${slug}: approved visual is below the release minimum`);
  }
  if(!page.learnMore?.href||!page.learnMore?.label) fail(`${slug}: deeper-learning link is required`);
  const ep=evidence.pages?.[slug];
  if(!ep) fail(`${slug}: evidence boundary record is required`);
}
const sourceIds=new Set((evidence.sources||[]).map(x=>x.id));
for(const [slug,entry] of Object.entries(evidence.pages||{})){
  for(const id of entry.sourceRefs||[]) if(!sourceIds.has(id)) fail(`${slug}: unknown evidence source ${id}`);
}
if(errors.length){
 console.error(`Simple User Guide validation failed with ${errors.length} issue(s):`);
 for(const e of errors) console.error(' - '+e);
 process.exit(1);
}
const counts=visuals.visuals.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{});
console.log(JSON.stringify({valid:true,pages:10,visualStatusCounts:counts,evidenceSources:evidence.sources.length},null,2));
