import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const registryPath=path.join(root,'site/deployment/public-apps.json');
const ciPath=path.join(root,'.github/workflows/growlens-ci.yml');
const suitePath=path.join(root,'.github/workflows/build-dtfseeds-public-suite.yml');
const swPath=path.join(root,'apps/growlens-web/public/sw.js');
const pwaTestPath=path.join(root,'apps/growlens-web/src/pwaHealth.test.ts');
const indexPath=path.join(root,'apps/growlens-web/index.html');

const fail=(message)=>{console.error('GrowLens release contract validation failed:',message);process.exitCode=1;};
for(const file of [registryPath,ciPath,suitePath,swPath,pwaTestPath,indexPath]){
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

const ci=fs.readFileSync(ciPath,'utf8');
for(const token of [
  'npm run test:growlens',
  'npm run test:growlens:live-client',
  'npm run build:growlens',
  'npm run validate:plant-atlas:v4',
  'npm run validate:terpene-atlas'
]){
  if(!ci.includes(token))fail(`GrowLens CI is missing canonical gate: ${token}`);
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
