#!/usr/bin/env node
import fs from 'node:fs';

const overlay=JSON.parse(fs.readFileSync('site/deployment/dtf420-static-overlay.json','utf8'));
const locations=JSON.parse(fs.readFileSync('data/game-location-registry.json','utf8'));
const registry=JSON.parse(fs.readFileSync('data/game-registry-v2.json','utf8'));
const errors=[];

function findGame(root,id){
  const candidates=[];
  const walk=v=>{
    if(Array.isArray(v)) for(const x of v) walk(x);
    else if(v&&typeof v==='object'){
      if(v.id===id) candidates.push(v);
      for(const x of Object.values(v)) walk(x);
    }
  };
  walk(root);
  return candidates[0]||null;
}

for(const prefix of overlay.routePrefixes||[]){
  if(!prefix.startsWith('games/')) continue;
  const id=prefix.slice('games/'.length);
  const locationGame=findGame(locations,id);
  const registryGame=findGame(registry,id);
  if(!locationGame){errors.push(`${prefix}: no game-location registry entry`);continue;}
  if(!registryGame){errors.push(`${prefix}: no game-registry-v2 entry`);continue;}

  const production=locationGame.production||{};
  const dev=(registryGame.developmentLocations||[]).find(x=>x.repository==='dtfgenetics/Dtf420')||{};
  const release=registryGame.release||{};

  const migrationIntegrated=
    production.repository==='dtfgenetics/Dtf420' &&
    production.integrationRepository==='dtfgenetics/Thc' &&
    production.integrationPath==='site/deployment/dtf420-static-overlay.json' &&
    production.integrationMode==='migration-static-overlay';

  if(!migrationIntegrated) errors.push(`${prefix}: Dtf420 game lacks explicit migration-overlay integration contract`);
  if(production.overlayEligible!==true) errors.push(`${prefix}: game-location registry does not mark overlayEligible=true`);
  if(release.overlayEligible!==true) errors.push(`${prefix}: game-registry-v2 does not mark overlayEligible=true`);
  if(dev.releasable!==true) errors.push(`${prefix}: Dtf420 development location must be releasable=true before production overlay staging`);
}

const deferred=new Map((overlay.deferredRoutes||[]).map(x=>[x.prefix,x]));
for(const blockedId of ['stoner-duck-race']){
  const prefix=`games/${blockedId}`;
  const locationGame=findGame(locations,blockedId);
  const registryGame=findGame(registry,blockedId);
  if((overlay.routePrefixes||[]).includes(prefix)) errors.push(`${prefix}: must remain out of production overlay while overlayEligible=false`);
  if(locationGame?.production?.overlayEligible!==false) errors.push(`${prefix}: game-location registry must explicitly mark overlayEligible=false`);
  if(registryGame?.release?.overlayEligible!==false) errors.push(`${prefix}: game-registry-v2 must explicitly mark overlayEligible=false`);
  if(!deferred.has(prefix)) errors.push(`${prefix}: deferral reason must remain explicit while route is withheld`);
}

if(errors.length){
  console.error(`Dtf420 overlay game eligibility failed with ${errors.length} issue(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log('Dtf420 overlay game eligibility valid: production overlay contains only explicitly migration-integrated, overlay-eligible games.');
