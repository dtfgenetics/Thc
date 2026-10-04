import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const registryPath=path.join(root,'site/deployment/public-apps.json');
const ciPath=path.join(root,'.github/workflows/growlens-ci.yml');
const suitePath=path.join(root,'.github/workflows/build-dtfseeds-public-suite.yml');
const swPath=path.join(root,'apps/growlens-web/public/sw.js');
const pwaTestPath=path.join(root,'apps/growlens-web/src/pwaHealth.test.ts');
const indexPath=path.join(root,'apps/growlens-web/index.html');
const readmePath=path.join(root,'apps/growlens-web/README.md');
const packagePath=path.join(root,'package.json');
const liveAcceptancePath=path.join(root,'.github/workflows/growlens-live-acceptance.yml');
const privateAuditPath=path.join(root,'scripts/growlens-private-data-audit.php');

const fail=(message)=>{console.error('GrowLens release contract validation failed:',message);process.exitCode=1;};
for(const file of [registryPath,ciPath,suitePath,swPath,pwaTestPath,indexPath,readmePath,packagePath,liveAcceptancePath,privateAuditPath]){
  if(!fs.existsSync(file))fail(`Required file missing: ${path.relative(root,file)}`);
}
if(process.exitCode)process.exit();

const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
const apps=registry.apps||[];
const growlens=apps.find((item)=>item?.id==='growlens');
if(!growlens)fail('public-apps.json is missing growlens.');
else{
  if(growlens.repository!=='dtfgenetics/Thc')fail(`Unexpected GrowLens repository: ${growlens.repository}`);
  if(growlens.sourcePath!=='apps/growlens-web')fail(`Unexpected GrowLens source path: ${growlens.sourcePath}`);
  if(growlens.route!=='/growlens/')fail(`Unexpected GrowLens route: ${growlens.route}`);
  if(growlens.status!=='ready-to-package')fail(`Unexpected GrowLens status: ${growlens.status}`);
  if(growlens.build!=='npm run verify:growlens')fail(`GrowLens registry must use canonical verifier; found: ${growlens.build}`);
}

const indexHtml=fs.readFileSync(indexPath,'utf8');
for(const token of [
  'data-growlens-static-fallback',
  'Local-first data and privacy',
  '/thc-grow-doc/',
  '/learn/search/',
  '/learn/encyclopedia/'
]){
  if(!indexHtml.includes(token))fail(`GrowLens static fallback is missing: ${token}`);
}
if((indexHtml.match(/class="static-card"/g)||[]).length<4)fail('GrowLens static fallback must expose at least four workflow cards.');

const packageJson=JSON.parse(fs.readFileSync(packagePath,'utf8'));
const scripts=packageJson.scripts||{};
for(const command of ['test:growlens','test:growlens:backend','test:growlens:live-client','test:live:growlens','build:growlens','verify:growlens']){
  if(!scripts[command])fail(`package.json is missing GrowLens command: ${command}`);
}
if(scripts['test:e2e:growlens'])fail('GrowLens must not advertise an undefined or duplicate local E2E lane; use the deterministic acceptance-client selftest plus guarded live acceptance.');

const readme=fs.readFileSync(readmePath,'utf8');
for(const token of [
  'npm run test:growlens',
  'php apps/growlens-web/tests/php-private-data-tools-smoke.php',
  'npm run test:growlens:live-client',
  'npm run build:growlens',
  'PHP backend smoke tests',
  'guarded live acceptance'
]){
  if(!readme.includes(token))fail(`GrowLens README is missing current verification guidance: ${token}`);
}
if(readme.includes('test:e2e:growlens'))fail('GrowLens README references undefined test:e2e:growlens.');
if(/Playwright desktop\/mobile tests/i.test(readme))fail('GrowLens README still claims a Playwright suite that is not part of the current release contract.');

const ci=fs.readFileSync(ciPath,'utf8');
for(const token of [
  'actions/checkout@v7',
  'actions/setup-node@v7',
  "node-version: '24'",
  'actions/upload-artifact@v7',
  'npm run test:growlens',
  'npm run test:growlens:live-client',
  'npm run build:growlens',
  'npm run validate:plant-atlas:v4',
  'npm run validate:terpene-atlas'
]){
  if(!ci.includes(token))fail(`GrowLens CI is missing canonical gate: ${token}`);
}

const liveAcceptance=fs.readFileSync(liveAcceptancePath,'utf8');
for(const token of [
  'actions/checkout@v7',
  'actions/setup-node@v7',
  "node-version: '24'",
  'actions/upload-artifact@v7',
  'npm run test:growlens:live-client',
  'npm run test:live:growlens',
  'RUN-DESTRUCTIVE-ACCEPTANCE'
]){
  if(!liveAcceptance.includes(token))fail(`GrowLens live acceptance workflow is missing current gate: ${token}`);
}

const privateAudit=fs.readFileSync(privateAuditPath,'utf8');
for(const token of [
  '$collectionsBySchema',
  'irrigationRecords',
  'feedingRecords',
  'reservoirRecords',
  'harvestRecords',
  'observationOutcomes',
  '$stateCollections = $collectionsBySchema[$schemaVersion]'
]){
  if(!privateAudit.includes(token))fail(`GrowLens private-data audit is missing schema-v2 compatibility: ${token}`);
}

const suite=fs.readFileSync(suitePath,'utf8');
for(const token of [
  'npm run test:growlens',
  'npm run build:growlens',
  'npm run validate:plant-atlas:v4',
  'npm run validate:terpene-atlas',
  'mkdir -p release/growlens',
  'cp -a apps/growlens-web/dist/. release/growlens/'
]){
  if(!suite.includes(token))fail(`Public-suite build is missing GrowLens packaging gate: ${token}`);
}

const sw=fs.readFileSync(swPath,'utf8');
const installBlock=sw.match(/self\.addEventListener\('install',[\s\S]*?\n\}\);/)?.[0]||'';
if(!sw.includes("event.data?.type === 'SKIP_WAITING'"))fail('Service worker is missing explicit SKIP_WAITING message handling.');
if(installBlock.includes('skipWaiting'))fail('Service worker install block must not auto-activate updates.');
if(!sw.includes("growlens-shell-v3"))fail('Expected current GrowLens shell cache version v3.');

const pwaTest=fs.readFileSync(pwaTestPath,'utf8');
for(const token of [
  'does not call skipWaiting during install',
  'does not claim offline readiness before registration',
  'cleans up both registration and installing-worker listeners'
]){
  if(!pwaTest.includes(token))fail(`PWA release contract test missing: ${token}`);
}

if(!process.exitCode)console.log('GrowLens release contract validated.');
