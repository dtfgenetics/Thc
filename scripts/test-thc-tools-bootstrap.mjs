import fs from 'node:fs';

const failures=[];
const ok=(value,message)=>{if(!value)failures.push(message)};

const manifestPath='migration/thc-tools-bootstrap/bootstrap-manifest.json';
ok(fs.existsSync(manifestPath),'bootstrap manifest is missing');

if(fs.existsSync(manifestPath)){
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  ok(manifest.schemaVersion===1,'bootstrap manifest schemaVersion must be 1');
  ok(manifest.targetRepository==='dtfgenetics/thc-tools','target repository mismatch');
  ok(Array.isArray(manifest.routes)&&manifest.routes.length===23,'bootstrap must contain 23 route surfaces');
  ok(Array.isArray(manifest.sharedAssets)&&manifest.sharedAssets.length>=10,'bootstrap shared runtime list is incomplete');
  ok(Array.isArray(manifest.thirdPartyNotices)&&manifest.thirdPartyNotices.length>=3,'third-party notice list is incomplete');
  ok(manifest.routes.some(item=>item.slug==='atlas'&&item.deploymentId==='plant-atlas'),'Plant Atlas deployment identity must be preserved');
  for(const slug of ['ipm-scout','grow-planner','breeder-pedigree']){
    ok(manifest.routes.some(item=>item.slug===slug),`bootstrap missing ${slug}`);
  }
}

if(failures.length){
  console.error(`THC tools bootstrap contract failed with ${failures.length} issue(s):`);
  for(const failure of failures) console.error(' - '+failure);
  process.exit(1);
}
console.log('THC tools bootstrap contract passed.');
