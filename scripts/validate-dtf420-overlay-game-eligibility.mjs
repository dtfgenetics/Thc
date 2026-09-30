#!/usr/bin/env node
import fs from 'node:fs';

const overlay=JSON.parse(fs.readFileSync('site/deployment/dtf420-static-overlay.json','utf8'));
const registry=JSON.parse(fs.readFileSync('data/game-location-registry.json','utf8'));
const errors=[];

function findGame(id){
  const candidates=[];
  const walk=v=>{
    if(Array.isArray(v)) for(const x of v) walk(x);
    else if(v&&typeof v==='object'){
      if(v.id===id) candidates.push(v);
      for(const x of Object.values(v)) walk(x);
    }
  };
  walk(registry);
  return candidates[0]||null;
}

for(const prefix of overlay.routePrefixes||[]){
  if(!prefix.startsWith('games/')) continue;
  const id=prefix.slice('games/'.length);
  const game=findGame(id);
  if(!game){errors.push(`${prefix}: no canonical game-location registry entry`);continue;}
  const production=game.production||{};
  const dev=(game.developmentLocations||[]).find(x=>x.repository==='dtfgenetics/Dtf420')||{};
  const release=game.release||{};
  const migrationIntegrated=production.repository==='dtfgenetics/Dtf420' &&
    production.integrationRepository==='dtfgenetics/Thc' &&
    production.integrationPath==='site/deployment/dtf420-static-overlay.json' &&
    production.integrationMode==='migration-static-overlay';
  const releasable=dev.releasable!==false && release.status!=='blocked';
  if(!migrationIntegrated) errors.push(`${prefix}: Dtf420 game lacks explicit migration-overlay integration contract`);
  if(!releasable) errors.push(`${prefix}: Dtf420 game registry marks route unreleasable`);
}

const deferred=new Set((overlay.deferredRoutes||[]).map(x=>x.prefix));
if((overlay.routePrefixes||[]).includes('games/stoner-duck-race')) errors.push('Stoner Duck Race must remain out of production overlay while releasable=false');
if(!deferred.has('games/stoner-duck-race')) errors.push('Stoner Duck Race deferral reason must remain explicit while route is withheld');

if(errors.length){
  console.error(`Dtf420 overlay game eligibility failed with ${errors.length} issue(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log('Dtf420 overlay game eligibility valid: only explicitly migration-integrated, releasable games may enter production overlay.');
