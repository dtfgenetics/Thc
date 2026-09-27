import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const revisionPath=path.join(root,'site/public-route-patch/assets/release-source-revisions/thc-grow-doc.txt');
const registryPath=path.join(root,'site/deployment/public-apps.json');
const buildWorkflowPath=path.join(root,'.github/workflows/build-dtfseeds-public-suite.yml');
const qualificationPath=path.join(root,'.github/workflows/public-suite-build-qualification.yml');

const fail=(message)=>{console.error('Grow Doc release pin validation failed:',message);process.exitCode=1;};

for(const file of [revisionPath,registryPath,buildWorkflowPath,qualificationPath]){
  if(!fs.existsSync(file)) fail(`Required file missing: ${path.relative(root,file)}`);
}
if(process.exitCode)process.exit();

const lines=Object.fromEntries(
  fs.readFileSync(revisionPath,'utf8').trim().split(/\r?\n/)
    .map((line)=>line.split('=',2))
    .filter(([key,value])=>key&&value)
);
if(lines.repository!=='dtfgenetics/Thc-dataset') fail(`Unexpected repository: ${lines.repository||'(missing)'}`);
if(!/^[0-9a-f]{40}$/.test(lines.commit||'')) fail('Pinned commit must be a full 40-character lowercase SHA.');
if(lines.route!=='/thc-grow-doc/') fail(`Unexpected route: ${lines.route||'(missing)'}`);
if(lines.lane!=='publicSuite') fail(`Unexpected lane: ${lines.lane||'(missing)'}`);

const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
const apps=Array.isArray(registry)?registry:(registry.apps||registry.publicApps||[]);
const growDoc=apps.find((item)=>item?.id==='thc-grow-doc');
if(!growDoc) fail('site/deployment/public-apps.json is missing thc-grow-doc.');
else{
  if(growDoc.repository!==lines.repository) fail('Registry repository does not match release-source pin.');
  if(growDoc.route!==lines.route) fail('Registry route does not match release-source pin.');
  if(growDoc.status!=='ready-to-package') fail(`Grow Doc registry status is ${growDoc.status}; expected ready-to-package.`);
  for(const token of ['npm run validate:model-eval','npm run check','npm test','npm run build']){
    if(!String(growDoc.build||'').includes(token)) fail(`Grow Doc registry build contract is missing: ${token}`);
  }
}

const buildWorkflow=fs.readFileSync(buildWorkflowPath,'utf8');
for(const token of [
  'release-source-revisions/thc-grow-doc.txt',
  'test "$repo_name" = "dtfgenetics/Thc-dataset"',
  'git fetch --depth=1 origin "$revision"',
  'test "$(git rev-parse HEAD)" = "$revision"',
  'npm run check',
  'npm test',
  'npm run build',
  'echo "THC_GROW_DOC_SHA=$revision"',
  '"thcGrowDoc": "$THC_GROW_DOC_SHA"'
]){
  if(!buildWorkflow.includes(token)) fail(`Public-suite build is missing Grow Doc pin/build contract: ${token}`);
}

const qualification=fs.readFileSync(qualificationPath,'utf8');
for(const token of [
  'release-source-revisions/thc-grow-doc.txt',
  'commit=$revision',
  'reference-media/crops',
  'reference-media/original'
]){
  if(!qualification.includes(token)) fail(`Public-suite qualification is missing Grow Doc release assertion: ${token}`);
}
const growDocAssertionForms=[
  '"thcGrowDoc": "$revision"',
  '\\"thcGrowDoc\\": \\"$revision\\"'
];
if(!growDocAssertionForms.some((token)=>qualification.includes(token))){
  fail('Public-suite qualification is missing a recognized Grow Doc build-manifest revision assertion.');
}

if(!process.exitCode){
  console.log(`Grow Doc release pin validated: ${lines.repository}@${lines.commit} -> ${lines.route}`);
}
