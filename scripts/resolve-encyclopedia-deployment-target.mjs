#!/usr/bin/env node
import { appendFileSync, readFileSync } from 'node:fs';

const args=new Set(process.argv.slice(2));
const targetPath=process.env.ENCYCLOPEDIA_DEPLOYMENT_TARGET||'site/wordpress/education/encyclopedia-deployment-target.json';
const target=JSON.parse(readFileSync(targetPath,'utf8'));

const fail=message=>{console.error('Encyclopedia deployment target invalid: '+message);process.exit(1);};

if(target.schemaVersion!==1) fail('schemaVersion must equal 1.');
if(target.id!=='encyclopedia-production-target-v1') fail('unexpected id.');
if(target.sourceRepository!=='dtfgenetics/thc-grow-hub') fail('unexpected sourceRepository.');
if(!/^[0-9a-f]{40}$/.test(String(target.sourceSha||''))) fail('sourceSha must be a full lowercase 40-character Git SHA.');
if(target.sourceRegistryPath!=='content/encyclopedia/current-controlled-registry.json') fail('unexpected sourceRegistryPath.');
if(!/^[0-9a-f]{40}$/.test(String(target.sourceRegistryBlobSha||''))) fail('sourceRegistryBlobSha must be a full lowercase 40-character Git blob SHA.');
if(target.integrationRepository!=='dtfgenetics/Thc') fail('unexpected integrationRepository.');
if(target.integrationMode!=='controlled-publication-integration') fail('unexpected integrationMode.');

const result={
  targetPath,
  sourceRepository:target.sourceRepository,
  sourceSha:target.sourceSha,
  sourceRegistryPath:target.sourceRegistryPath,
  sourceRegistryBlobSha:target.sourceRegistryBlobSha,
  lane:target.lane||null,
  integrationRepository:target.integrationRepository,
  integrationMode:target.integrationMode,
  updatedAt:target.updatedAt||null
};

if(args.has('--github-env')){
  const githubEnv=process.env.GITHUB_ENV;
  if(!githubEnv) fail('GITHUB_ENV is required with --github-env.');
  appendFileSync(githubEnv,`THC_ENCYCLOPEDIA_SOURCE_SHA=${target.sourceSha}\n`);
}

console.log(JSON.stringify(result,null,2));
