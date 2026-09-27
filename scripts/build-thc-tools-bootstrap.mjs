import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const manifestPath=path.join(root,'migration/thc-tools-bootstrap/bootstrap-manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const out=path.resolve(process.argv[2]||'tmp/thc-tools-bootstrap');

function copyRequired(source,destination){
  if(!fs.existsSync(source)) throw new Error('Missing bootstrap source: '+source);
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.cpSync(source,destination,{recursive:true});
}

fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});

copyRequired(path.join(root,'data/tool-registry.json'),path.join(out,'data/tool-registry.json'));
copyRequired(path.join(root,'migration/thc-tools-bootstrap/repo-package.json'),path.join(out,'package.json'));
copyRequired(path.join(root,'migration/thc-tools-bootstrap/repo-README.md'),path.join(out,'README.md'));
copyRequired(path.join(root,'migration/thc-tools-bootstrap/seed'),out);
copyRequired(path.join(root,'docs/THC_TOOLS_MIGRATION_INVENTORY.md'),path.join(out,'docs/THC_TOOLS_MIGRATION_INVENTORY.md'));

for(const route of manifest.routes){
  copyRequired(path.join(root,route.sourceRoot),path.join(out,'apps',route.slug));
}

for(const asset of manifest.sharedAssets){
  const rel=asset.replace(/^site\/public-route-patch\//,'');
  copyRequired(path.join(root,asset),path.join(out,'public',rel));
}

for(const notice of manifest.thirdPartyNotices){
  copyRequired(path.join(root,notice),path.join(out,'docs',path.basename(notice)));
}

const report={
  schemaVersion:manifest.schemaVersion,
  sourceRepository:manifest.sourceRepository,
  targetRepository:manifest.targetRepository,
  routeCount:manifest.routes.length,
  sharedAssetCount:manifest.sharedAssets.length,
  generatedAt:new Date().toISOString()
};
fs.writeFileSync(path.join(out,'bootstrap-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
