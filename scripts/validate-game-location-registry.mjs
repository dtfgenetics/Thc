import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const loc=JSON.parse(fs.readFileSync(path.join(root,'data/game-location-registry.json'),'utf8'));
const source=JSON.parse(fs.readFileSync(path.join(root,'data/game-source-map.json'),'utf8'));
const deployRaw=JSON.parse(fs.readFileSync(path.join(root,'site/deployment/public-apps.json'),'utf8'));
const deploy=Array.isArray(deployRaw)?deployRaw:(deployRaw.apps||deployRaw.games||[]);

const errors=[];
if(loc.schemaVersion!==1) errors.push('game-location-registry schemaVersion must be 1');
const ids=new Set();
const aliases=new Map();
for(const game of loc.games||[]){
  if(!game?.id) errors.push('location entry missing id');
  if(ids.has(game.id)) errors.push(`duplicate game id: ${game.id}`);
  ids.add(game.id);
  for(const alias of game.aliases||[]){
    const key=String(alias).trim().toLowerCase();
    if(!key) continue;
    if(aliases.has(key)&&aliases.get(key)!==game.id) errors.push(`alias collision: ${key} -> ${aliases.get(key)} / ${game.id}`);
    aliases.set(key,game.id);
    if(loc.aliasMap?.[key]!==game.id) errors.push(`aliasMap mismatch: ${key} -> ${loc.aliasMap?.[key]} expected ${game.id}`);
  }
  if(game.production){
    if(!game.production.repository) errors.push(`${game.id}: production repository missing`);
    if(!Array.isArray(game.production.sourcePaths)||game.production.sourcePaths.length===0) errors.push(`${game.id}: production sourcePaths missing`);
  }
}
for(const game of source.games||[]){
  if(!ids.has(game.id)) errors.push(`source-map game missing from location registry: ${game.id}`);
  const entry=(loc.games||[]).find(x=>x.id===game.id);
  if(entry?.production?.repository!==game.canonical?.repository) errors.push(`${game.id}: production repository drift: ${entry?.production?.repository} vs ${game.canonical?.repository}`);
  if(entry?.publicRoute!==game.route) errors.push(`${game.id}: public route drift: ${entry?.publicRoute} vs ${game.route}`);
}
const deployGameIds=new Set(deploy.filter(x=>String(x.route||'').startsWith('/games/')).map(x=>x.id||x.gameId).filter(Boolean));
for(const id of deployGameIds){
  if(!ids.has(id) && id!=='cannabis-fleet-battle') errors.push(`deployment game missing from location registry: ${id}`);
}
const burn=(loc.games||[]).find(x=>x.id==='protect-the-plants');
if(burn?.production?.sourcePaths?.[0]!=='games/protect-the-plants') errors.push('Burn Buds production source must resolve to games/protect-the-plants');
if((burn?.developmentLocations||[]).some(x=>x.repository==='dtfgenetics/Thc'&&x.paths?.includes('games/cannabis-fleet-battle'))) errors.push('Archived Cannabis Fleet Battle must not be represented as active Burn Buds development source');

if(errors.length){
  console.error('Game location registry validation failed:\n- '+errors.join('\n- '));
  process.exitCode=1;
}else{
  console.log(`Game location registry valid: ${ids.size} games, ${aliases.size} aliases.`);
}
