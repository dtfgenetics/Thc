#!/usr/bin/env node
import fs from 'node:fs';

const registry=JSON.parse(fs.readFileSync('data/game-registry-v2.json','utf8'));
const profiles=JSON.parse(fs.readFileSync('configuration/game-qa/game-profiles.json','utf8'));
const errors=[];
const warnings=[];
const strict=process.argv.includes('--strict');
const idIndex=process.argv.indexOf('--id');
const requestedId=idIndex>=0 ? process.argv[idIndex+1] : null;
if(idIndex>=0 && !requestedId){
  console.error('Usage: node scripts/validate-game-profiles.mjs [--strict] [--id <game-id>]');
  process.exit(2);
}

const dimensions=profiles.dimensions||{};
const dimensionNames=Object.keys(dimensions);

function fail(message){ errors.push(message); }
function warn(message){ warnings.push(message); }

if(profiles.schemaVersion!==1) fail('game profile schemaVersion must be 1');
if(!Array.isArray(profiles.references)||profiles.references.length<3) fail('profile catalog must retain external reference records');
if(!profiles.games||typeof profiles.games!=='object') fail('profile catalog games map is required');

const registryIds=new Set((registry.games||[]).map(game=>game.id));
const mappedIds=new Set(Object.keys(profiles.games||{}));

for(const id of registryIds){
  if(!mappedIds.has(id)) fail(`${id}: missing game profile assignment`);
}
for(const id of mappedIds){
  if(!registryIds.has(id)) fail(`${id}: game profile assignment points to unknown registry game`);
}

const scopedGames=requestedId
  ? (registry.games||[]).filter(game=>game.id===requestedId)
  : (registry.games||[]);
if(requestedId && scopedGames.length===0) fail(`unknown game id: ${requestedId}`);

for(const game of scopedGames){
  const assignment=profiles.games?.[game.id];
  if(!assignment || typeof assignment!=='object' || Array.isArray(assignment)) {
    fail(`${game.id}: profile assignment must be an object with named dimensions`);
    continue;
  }

  const values={};
  for(const name of dimensionNames){
    const value=assignment[name];
    values[name]=value;
    if(typeof value!=='string') fail(`${game.id}: missing ${name}`);
    else if(!(dimensions[name]||[]).includes(value)) fail(`${game.id}: unknown ${name} value ${value}`);
  }
  for(const extra of Object.keys(assignment)){
    if(!dimensionNames.includes(extra)) fail(`${game.id}: unknown profile dimension ${extra}`);
  }

  if(!profiles.performanceBudgets?.[values.performanceProfile]){
    fail(`${game.id}: missing performance budget for ${values.performanceProfile}`);
  }
  if(!profiles.requiredChecks?.[values.gameplayProfile]){
    fail(`${game.id}: missing gameplay requiredChecks profile for ${values.gameplayProfile}`);
  }
  for(const dimension of ['rendererProfile','sessionProfile','persistenceProfile','networkProfile','contentProfile','performanceProfile','securityProfile','accessibilityProfile']){
    if(!profiles.dimensionChecks?.[dimension]?.[values[dimension]]){
      fail(`${game.id}: missing dimensionChecks for ${dimension}=${values[dimension]}`);
    }
  }

  const onlineNetwork=new Set(['request-response-authoritative','turn-authoritative','realtime-authoritative','optional-realtime']);
  const onlineSecurity=new Set(['casual-online','competitive-online','community-online']);
  if(onlineNetwork.has(values.networkProfile)&&!onlineSecurity.has(values.securityProfile)){
    fail(`${game.id}: online network profile ${values.networkProfile} requires an online security profile`);
  }
  if(!onlineNetwork.has(values.networkProfile)&&onlineSecurity.has(values.securityProfile)){
    warn(`${game.id}: online security profile ${values.securityProfile} is stronger than current network profile ${values.networkProfile}`);
  }

  if(values.gameplayProfile==='realtime-multiplayer'&&!['realtime-authoritative','optional-realtime'].includes(values.networkProfile)){
    fail(`${game.id}: realtime-multiplayer must use realtime-authoritative or optional-realtime network profile`);
  }
  if(values.gameplayProfile==='turn-multiplayer'&&!['turn-authoritative','request-response-authoritative'].includes(values.networkProfile)){
    fail(`${game.id}: turn-multiplayer must use turn-authoritative or request-response-authoritative network profile`);
  }

  if(values.rendererProfile==='threejs'&&values.performanceProfile!=='3d-game'){
    fail(`${game.id}: Three.js renderer must use 3d-game performance profile`);
  }

  const saveVersion=game.architecture?.saveVersion;
  if(['campaign','checkpoint'].includes(values.persistenceProfile)&&!Number.isInteger(saveVersion)){
    warn(`${game.id}: ${values.persistenceProfile} persistence should declare architecture.saveVersion before strict production compliance`);
  }
  if(values.persistenceProfile==='match-recovery'){
    const recoveryVersion=game.architecture?.sessionSchemaVersion ?? game.architecture?.protocolVersion ?? null;
    if(!Number.isInteger(recoveryVersion)){
      warn(`${game.id}: match-recovery should declare architecture.sessionSchemaVersion or architecture.protocolVersion before strict production compliance`);
    }
  }

  const architectureNetwork=String(game.architecture?.networkModel||'').toLowerCase();
  if(values.networkProfile==='local' && /(socket|multiplayer|server-authoritative|colyseus)/.test(architectureNetwork)){
    warn(`${game.id}: profile says local but architecture.networkModel suggests networked runtime: ${game.architecture.networkModel}`);
  }

  if(values.gameplayProfile==='campaign-rpg' && !['long','persistent'].includes(values.sessionProfile)){
    fail(`${game.id}: campaign-rpg should use long or persistent session profile`);
  }
}

for(const [name,budget] of Object.entries(profiles.performanceBudgets||{})){
  if(!Number.isInteger(budget.initialBytesSoft)||!Number.isInteger(budget.initialBytesHard)||budget.initialBytesSoft>budget.initialBytesHard){
    fail(`${name}: invalid initial byte budget`);
  }
  if(!Number.isInteger(budget.targetTimeToPlayableMs)||budget.targetTimeToPlayableMs<1000){
    fail(`${name}: invalid targetTimeToPlayableMs`);
  }
}

for(const warning of warnings) console.warn(`WARN: ${warning}`);

if(errors.length || (strict&&warnings.length)){
  console.error(`Game profile validation failed: ${errors.length} error(s), ${warnings.length} warning(s)${strict?' (strict mode)':''}.`);
  for(const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Game profiles valid: ${requestedId ? 1 : registryIds.size} game(s) checked across ${dimensionNames.length} dimensions; ${warnings.length} compliance warning(s).`);
