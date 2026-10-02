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

function gameIdFromPrefix(prefix){
  if(typeof prefix!=='string'||!prefix.startsWith('games/')) return null;
  const id=prefix.slice('games/'.length).replace(/\/$/,'');
  return id||null;
}

function normalizePublicRoute(route){
  if(typeof route!=='string') return null;
  const clean='/' + route.replace(/^\/+|\/+$/g,'');
  return clean==='/'?'/':clean+'/';
}

function expectedPublicRoute(id){
  return `/games/${id}/`;
}

const activePrefixes=new Set(overlay.routePrefixes||[]);
const deferredPrefixes=new Set();

for(const deferred of overlay.deferredRoutes||[]){
  const prefix=deferred?.prefix;
  if(typeof prefix!=='string'||!prefix.trim()){
    errors.push('deferred route entry must declare a non-empty prefix');
    continue;
  }
  if(deferredPrefixes.has(prefix)) errors.push(`${prefix}: duplicate deferred route entry`);
  deferredPrefixes.add(prefix);
  if(activePrefixes.has(prefix)) errors.push(`${prefix}: route cannot be both active and deferred`);
  if(!deferred.reason?.trim()) errors.push(`${prefix}: deferred route must record a reason`);
  if(!deferred.releaseCondition?.trim()) errors.push(`${prefix}: deferred route must record a releaseCondition`);
}

for(const prefix of activePrefixes){
  const id=gameIdFromPrefix(prefix);
  if(!id) continue;
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

  const actualRoute=normalizePublicRoute(registryGame.publicRoute);
  const expected=expectedPublicRoute(id);
  if(actualRoute!==expected) errors.push(`${prefix}: publicRoute must normalize to ${expected}; found ${registryGame.publicRoute}`);
}

for(const prefix of deferredPrefixes){
  const id=gameIdFromPrefix(prefix);
  if(!id) continue;
  const locationGame=findGame(locations,id);
  const registryGame=findGame(registry,id);
  if(!locationGame){errors.push(`${prefix}: deferred game has no game-location registry entry`);continue;}
  if(!registryGame){errors.push(`${prefix}: deferred game has no game-registry-v2 entry`);continue;}

  const dev=(registryGame.developmentLocations||[]).find(x=>x.repository==='dtfgenetics/Dtf420')||{};
  if(locationGame?.production?.overlayEligible!==false) errors.push(`${prefix}: deferred game-location registry must explicitly mark overlayEligible=false`);
  if(registryGame?.release?.overlayEligible!==false) errors.push(`${prefix}: deferred game-registry-v2 must explicitly mark overlayEligible=false`);
  if(dev.releasable!==false) errors.push(`${prefix}: deferred Dtf420 development location must explicitly mark releasable=false`);

  const actualRoute=normalizePublicRoute(registryGame.publicRoute);
  const expected=expectedPublicRoute(id);
  if(actualRoute!==expected) errors.push(`${prefix}: publicRoute must normalize to ${expected}; found ${registryGame.publicRoute}`);
}

for(const game of registry.games||[]){
  const dev=(game.developmentLocations||[]).find(x=>x.repository==='dtfgenetics/Dtf420');
  if(!dev) continue;
  const prefix=`games/${game.id}`;
  const isActive=activePrefixes.has(prefix);
  const isDeferred=deferredPrefixes.has(prefix);

  if(game.release?.overlayEligible===true && dev.releasable===true && !isActive){
    errors.push(`${prefix}: registry says overlayEligible/releasable but route is absent from active overlay prefixes`);
  }
  if(game.release?.overlayEligible===false && isActive){
    errors.push(`${prefix}: registry marks overlayEligible=false but route is active`);
  }
  if(dev.releasable===false && isActive){
    errors.push(`${prefix}: development location is releasable=false but route is active`);
  }
  if(game.release?.overlayEligible===false && !isDeferred && !isActive){
    errors.push(`${prefix}: Dtf420 game is withheld but missing an explicit deferred route record`);
  }
}

if(errors.length){
  console.error(`Dtf420 overlay game eligibility failed with ${errors.length} issue(s):`);
  for(const e of errors) console.error(' - '+e);
  process.exit(1);
}
console.log(`Dtf420 overlay game eligibility valid: ${[...activePrefixes].filter(x=>x.startsWith('games/')).length} active game route(s), ${[...deferredPrefixes].filter(x=>x.startsWith('games/')).length} deferred game route(s), all reconciled with canonical registries.`);
