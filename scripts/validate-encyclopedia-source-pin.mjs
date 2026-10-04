#!/usr/bin/env node
import fs from 'node:fs';

const targetPath='site/wordpress/education/encyclopedia-deployment-target.json';
const registryPath='data/project-execution-registry.json';
const appsPath='site/deployment/public-apps.json';
const errors=[];

if(!fs.existsSync(targetPath)) errors.push('missing encyclopedia deployment target');
if(!fs.existsSync(registryPath)) errors.push('missing project execution registry');
if(!fs.existsSync(appsPath)) errors.push('missing public apps registry');

if(!errors.length){
  const target=JSON.parse(fs.readFileSync(targetPath,'utf8'));
  const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
  const apps=JSON.parse(fs.readFileSync(appsPath,'utf8'));

  if(target.schemaVersion!==1) errors.push('deployment target schemaVersion must equal 1');
  if(target.id!=='encyclopedia-production-target-v1') errors.push('deployment target id mismatch');
  if(target.sourceRepository!=='dtfgenetics/thc-grow-hub') errors.push('deployment target sourceRepository mismatch');
  if(!/^[0-9a-f]{40}$/.test(target.sourceSha||'')) errors.push('deployment target must use a full lowercase 40-character SHA');
  if(target.sourceRegistryPath!=='content/encyclopedia/current-controlled-registry.json') errors.push('deployment target sourceRegistryPath mismatch');
  if(!/^[0-9a-f]{40}$/.test(target.sourceRegistryBlobSha||'')) errors.push('deployment target sourceRegistryBlobSha must be a full lowercase Git blob SHA');
  if(target.integrationRepository!=='dtfgenetics/Thc') errors.push('integrationRepository mismatch');
  if(target.integrationMode!=='controlled-publication-integration') errors.push('integrationMode mismatch');

  const project=(registry.projects||[]).find(row=>row.id==='encyclopedia');
  if(!project) errors.push('project execution registry is missing encyclopedia project');
  else {
    if(project.canonicalRepo!==target.sourceRepository) errors.push('project canonicalRepo must match deployment target sourceRepository');
    if(project.integration?.repo!==target.integrationRepository) errors.push('project integration repo mismatch');
    if(project.integration?.mode!=='controlled-publication-integration') errors.push('project integration mode mismatch');
    if(project.integration?.sourcePin!==targetPath) errors.push('project integration sourcePin must point to encyclopedia deployment target');
  }

  const app=(apps.apps||apps).find?.(row=>row.repository==='dtfgenetics/thc-grow-hub' || row.id==='thc-grow-hub');
  if(!app) errors.push('public app registry is missing thc-grow-hub integration record');

  if(fs.existsSync('scripts/resolve-encyclopedia-deployment-target.mjs')){
    const src=fs.readFileSync('scripts/resolve-encyclopedia-deployment-target.mjs','utf8');
    if(!src.includes('THC_ENCYCLOPEDIA_SOURCE_SHA')) errors.push('resolver must export THC_ENCYCLOPEDIA_SOURCE_SHA');
    if(!src.includes('dtfgenetics/thc-grow-hub')) errors.push('resolver must bind the canonical thc-grow-hub repository');
  } else errors.push('missing encyclopedia deployment-target resolver');
}

if(errors.length){
  console.error('Encyclopedia source-pin validation failed with '+errors.length+' issue(s):');
  for(const error of errors) console.error(' - '+error);
  process.exit(1);
}
console.log('Encyclopedia source pin valid: production integration targets dtfgenetics/thc-grow-hub@'+JSON.parse(fs.readFileSync(targetPath,'utf8')).sourceSha+'.');
