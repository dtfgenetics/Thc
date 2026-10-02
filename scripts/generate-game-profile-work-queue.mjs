#!/usr/bin/env node
import fs from 'node:fs';

const check=process.argv.includes('--check');
const registry=JSON.parse(fs.readFileSync('data/game-registry-v2.json','utf8'));
const compliance=JSON.parse(fs.readFileSync('data/game-profile-compliance.json','utf8'));
const outputPath='data/game-profile-work-queue.json';

const statusPriority={
  'public-verified':1,
  'public-unverified':1,
  'packaged':1,
  'release-candidate':1,
  'playable-local':2,
  'vertical-slice':3,
  'prototype':4,
  'design':5
};

const gameById=new Map((registry.games||[]).map(game=>[game.id,game]));
const items=[];

for(const row of compliance.games||[]){
  const game=gameById.get(row.id);
  if(!game) continue;
  for(const debt of row.debt||[]){
    let action='Inspect canonical implementation and close the recorded compliance gap.';
    let evidence=[];
    if(debt.code==='missing-save-version'){
      action='Version the durable save schema in canonical source, preserve backward compatibility, and add migration/corrupt-save regression coverage.';
      evidence=['real save version in canonical source','migration/backward-compatibility test','corrupt/restricted-storage fallback test','central registry architecture.saveVersion'];
    } else if(debt.code==='missing-session-or-protocol-version'){
      action='Introduce an explicit multiplayer session/protocol version in canonical source and verify reconnect/resume compatibility across the supported version boundary.';
      evidence=['real sessionSchemaVersion or protocolVersion','reconnect/resume compatibility test','stale/incompatible session behavior','central registry version metadata'];
    } else if(debt.code==='online-liveops-adoption-gap'){
      action='Adopt DTF shared live-ops and observability contracts (or a tested compatible adapter) in the canonical online runtime.';
      evidence=['maintenance/disable behavior','multiplayer kill-switch behavior','operational metrics/error instrumentation','health/live runtime verification'];
    }

    items.push({
      id:`${row.id}:${debt.code}`,
      gameId:row.id,
      title:row.title,
      priority:statusPriority[row.releaseStatus] ?? 5,
      releaseStatus:row.releaseStatus,
      debtCode:debt.code,
      severity:debt.severity,
      canonicalRepository:game.production?.repository ?? null,
      sourcePaths:game.production?.sourcePaths ?? [],
      integrationRepository:game.production?.integrationRepository ?? registry.authority?.productionControlRepository ?? null,
      publicRoute:game.publicRoute ?? null,
      action,
      requiredEvidence:evidence,
      verificationCommands:game.verification?.testCommands ?? [],
      strictProfileCommand:`npm run games:profiles:strict -- --id ${row.id}`
    });
  }
}

items.sort((a,b)=>a.priority-b.priority || a.gameId.localeCompare(b.gameId) || a.debtCode.localeCompare(b.debtCode));

const queue={
  schemaVersion:1,
  generatedFrom:['data/game-profile-compliance.json','data/game-registry-v2.json'],
  summary:{
    itemCount:items.length,
    gameCount:new Set(items.map(item=>item.gameId)).size,
    priority1:items.filter(item=>item.priority===1).length,
    priority2:items.filter(item=>item.priority===2).length
  },
  policy:{
    noFakeMetadata:'Do not close an item by inventing version numbers or declaring unsupported capabilities. Inspect canonical source and add real evidence.',
    ownership:'Implement in canonicalRepository; update central registry/integration metadata in the same coordinated change.',
    release:'A queue item is closed only when canonical tests pass and the scoped strict profile check passes.'
  },
  items
};

const text=JSON.stringify(queue,null,2)+'\n';
if(check){
  if(!fs.existsSync(outputPath)){
    console.error(`${outputPath} is missing; run npm run games:profiles:queue`);
    process.exit(1);
  }
  const current=fs.readFileSync(outputPath,'utf8').replace(/\r\n/g,'\n');
  if(current!==text.replace(/\r\n/g,'\n')){
    console.error(`${outputPath} is stale; run npm run games:profiles:queue`);
    process.exit(1);
  }
  console.log(`Game profile work queue current: ${items.length} item(s) across ${queue.summary.gameCount} game(s).`);
  process.exit(0);
}

fs.writeFileSync(outputPath,text);
console.log(`Wrote ${outputPath}: ${items.length} item(s) across ${queue.summary.gameCount} game(s).`);
