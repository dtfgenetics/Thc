#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const registry=JSON.parse(fs.readFileSync('data/game-registry-v2.json','utf8'));
const profiles=JSON.parse(fs.readFileSync('configuration/game-qa/game-profiles.json','utf8'));
const argv=process.argv.slice(2);
const asJson=argv.includes('--json');

function arg(name){
  const i=argv.indexOf(name);
  return i>=0 ? argv[i+1] : null;
}
function git(args,fallback=''){
  try{return execFileSync('git',args,{encoding:'utf8'}).trim();}catch{return fallback;}
}
function normalize(p){return String(p||'').replace(/^\.\//,'').replace(/\\/g,'/');}
function matchesPrefix(file,prefix){
  const f=normalize(file), p=normalize(prefix).replace(/\/$/,'');
  return f===p || f.startsWith(p+'/');
}

let files=[];
const explicit=arg('--files');
if(explicit) files=explicit.split(',').map(normalize).filter(Boolean);
else{
  const base=arg('--base')||process.env.GITHUB_BASE_SHA||git(['merge-base','origin/main','HEAD']);
  const head=arg('--head')||process.env.GITHUB_SHA||'HEAD';
  const diff=base?git(['diff','--name-only',`${base}...${head}`]):git(['show','--pretty=','--name-only',head]);
  files=diff?diff.split(/\r?\n/).map(normalize).filter(Boolean):[];
}

const globalProfilePaths=[
  'configuration/game-qa/game-profiles.json',
  'scripts/validate-game-profiles.mjs',
  'scripts/generate-game-profile-compliance.mjs'
];
const sharedPlatformPaths=['games/shared-platform/','site/public-route-patch/games/shared-platform/'];
const registryPaths=['data/game-registry-v2.json','data/game-profile-compliance.json'];

const affected=[];
for(const game of registry.games||[]){
  const reasons=[];
  const repo=game.production?.repository;
  const sourcePaths=game.production?.sourcePaths||[];
  const integrationPath=game.production?.integrationPath;
  if(repo==='dtfgenetics/Thc'){
    for(const file of files){
      if(sourcePaths.some(prefix=>matchesPrefix(file,prefix))) reasons.push(`canonical-source:${file}`);
      if(integrationPath && matchesPrefix(file,integrationPath)) reasons.push(`integration:${file}`);
    }
  } else {
    for(const file of files){
      if(integrationPath && matchesPrefix(file,integrationPath)) reasons.push(`external-integration:${file}`);
    }
  }

  if(files.some(file=>globalProfilePaths.some(prefix=>matchesPrefix(file,prefix)))){
    reasons.push('profile-contract-change');
  }
  if(files.some(file=>registryPaths.some(prefix=>matchesPrefix(file,prefix)))){
    reasons.push('registry-change');
  }

  const shared=game.architecture?.sharedSystems||[];
  const adoptsShared=shared.some(x=>/DTF shared|browser experience|shared browser/i.test(String(x)));
  if(adoptsShared && files.some(file=>sharedPlatformPaths.some(prefix=>matchesPrefix(file,prefix)))){
    reasons.push('shared-platform-change');
  }

  if(reasons.length){
    affected.push({
      id:game.id,
      title:game.title,
      repository:repo,
      local:repo==='dtfgenetics/Thc',
      reasons:[...new Set(reasons)],
      testCommands:game.verification?.testCommands||[],
      strictProfileCommand:`npm run games:profiles:strict -- --id ${game.id}`,
      profile:profiles.games?.[game.id]||null
    });
  }
}

const result={
  schemaVersion:1,
  changedFiles:files,
  affectedCount:affected.length,
  localCount:affected.filter(x=>x.local).length,
  externalCount:affected.filter(x=>!x.local).length,
  affected
};

if(asJson){
  console.log(JSON.stringify(result,null,2));
  process.exit(0);
}

console.log(`Affected games: ${result.affectedCount} total (${result.localCount} local, ${result.externalCount} external)`);
for(const game of affected){
  console.log(`\n# ${game.title} [${game.id}]`);
  console.log(`Repository: ${game.repository}`);
  console.log(`Reasons: ${game.reasons.join(', ')}`);
  console.log(`Strict profile: ${game.strictProfileCommand}`);
  if(game.testCommands.length){
    console.log('Verification:');
    for(const cmd of game.testCommands) console.log(`- ${cmd}`);
  } else {
    console.log('Verification: no registry test command recorded');
  }
}
