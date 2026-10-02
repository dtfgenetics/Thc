#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,'data/game-registry-v2.json'),'utf8'));
const externalDir=path.join(root,'site/deployment/external-games');
const errors=[];

function parsePin(text){
  const values={};
  for(const rawLine of text.split(/\r?\n/)){
    const line=rawLine.trim();
    if(!line||line.startsWith('#')) continue;
    const index=line.indexOf('=');
    if(index<=0) continue;
    values[line.slice(0,index).trim()]=line.slice(index+1).trim();
  }
  return values;
}

function normalizeRoute(value){
  if(typeof value!=='string'||!value.trim()) return null;
  const clean='/' + value.trim().replace(/^\/+|\/+$/g,'');
  return clean==='/'?'/':clean+'/';
}

const externalFiles=fs.readdirSync(externalDir).filter(name=>name.endsWith('.json')).sort();
for(const filename of externalFiles){
  const contract=JSON.parse(fs.readFileSync(path.join(externalDir,filename),'utf8'));
  const game=(registry.games||[]).find(entry=>entry.id===contract.id);
  if(!game){
    errors.push(`${filename}: external contract has no canonical game-registry-v2 entry`);
    continue;
  }

  if(game.production?.integrationMode!=='external-pinned-static-build') continue;

  const pinPath=game.production?.integrationPath;
  if(typeof pinPath!=='string'||!pinPath.endsWith('source-revision.txt')){
    errors.push(`${contract.id}: external-pinned-static-build requires a source-revision.txt integrationPath`);
    continue;
  }

  const absolute=path.join(root,pinPath);
  if(!fs.existsSync(absolute)){
    errors.push(`${contract.id}: missing release pin ${pinPath}`);
    continue;
  }

  const pin=parsePin(fs.readFileSync(absolute,'utf8'));
  const expectedRevision=game.release?.candidateRevision || game.release?.sourceValidatedRevision || contract.verifiedRevision;

  if(pin.repository!==game.production.repository){
    errors.push(`${contract.id}: pin repository ${pin.repository||'<missing>'} != canonical ${game.production.repository}`);
  }
  if(contract.repository!==game.production.repository){
    errors.push(`${contract.id}: external contract repository ${contract.repository||'<missing>'} != canonical ${game.production.repository}`);
  }
  if(!/^[0-9a-f]{40}$/i.test(pin.commit||'')){
    errors.push(`${contract.id}: pin commit must be an exact 40-character Git SHA`);
  }
  if(contract.verifiedRevision!==pin.commit){
    errors.push(`${contract.id}: external verifiedRevision ${contract.verifiedRevision||'<missing>'} != pin commit ${pin.commit||'<missing>'}`);
  }
  if(expectedRevision&&expectedRevision!==pin.commit){
    errors.push(`${contract.id}: canonical release revision ${expectedRevision} != pin commit ${pin.commit||'<missing>'}`);
  }

  const canonicalRoute=normalizeRoute(game.publicRoute);
  const contractRoute=normalizeRoute(contract.route);
  const pinRoute=normalizeRoute(pin.route);
  if(!canonicalRoute){
    errors.push(`${contract.id}: canonical registry publicRoute is missing`);
  } else {
    if(contractRoute!==canonicalRoute) errors.push(`${contract.id}: external route ${contract.route||'<missing>'} != canonical ${canonicalRoute}`);
    if(pinRoute!==canonicalRoute) errors.push(`${contract.id}: pin route ${pin.route||'<missing>'} != canonical ${canonicalRoute}`);
  }

  if(pin.artifact&&contract.artifact&&pin.artifact!==contract.artifact){
    errors.push(`${contract.id}: pin artifact ${pin.artifact} != external contract artifact ${contract.artifact}`);
  }
  if(!pin.release){
    errors.push(`${contract.id}: pin must declare a release version`);
  }
}

if(errors.length){
  console.error(`Game release pin validation failed with ${errors.length} issue(s):`);
  for(const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Game release pins valid: external pinned builds agree with canonical registry, external contracts, exact source revisions, and public routes.`);
