#!/usr/bin/env node
import fs from 'node:fs';

const check=process.argv.includes('--check');
const registry=JSON.parse(fs.readFileSync('data/game-registry-v2.json','utf8'));
const profiles=JSON.parse(fs.readFileSync('configuration/game-qa/game-profiles.json','utf8'));
const outputPath='data/game-profile-compliance.json';

function buildDebt(game, profile){
  const debt=[];
  const saveVersion=game.architecture?.saveVersion;
  const validSaveVersion=(Number.isInteger(saveVersion)&&saveVersion>=1)||(typeof saveVersion==='string'&&saveVersion.trim().length>0);
  if(['campaign','checkpoint'].includes(profile.persistenceProfile) && !validSaveVersion){
    debt.push({
      code:'missing-save-version',
      severity:'release-blocking-for-strict-profile',
      requirement:'Declare a real architecture.saveVersion and preserve migration/recovery evidence.'
    });
  }
  if(profile.persistenceProfile==='match-recovery'
    && !Number.isInteger(game.architecture?.sessionSchemaVersion)
    && !Number.isInteger(game.architecture?.protocolVersion)){
    debt.push({
      code:'missing-session-or-protocol-version',
      severity:'release-blocking-for-strict-profile',
      requirement:'Declare a real architecture.sessionSchemaVersion or architecture.protocolVersion and verify reconnect compatibility.'
    });
  }
  if(['request-response-authoritative','turn-authoritative','realtime-authoritative','optional-realtime'].includes(profile.networkProfile)){
    debt.push({
      code:'online-liveops-adoption-gap',
      severity:'game-follow-up',
      requirement:'Adopt the shared live-ops and observability contracts in the canonical online runtime and verify maintenance/kill-switch plus operational metrics behavior.'
    });
  }
  return debt;
}

const games=(registry.games||[]).map(game=>{
  const profile=profiles.games?.[game.id]||{};
  const debt=buildDebt(game,profile);
  return {
    id:game.id,
    title:game.title,
    releaseStatus:game.release?.status ?? null,
    profile,
    compliant:debt.length===0,
    debt
  };
});

const report={
  schemaVersion:1,
  generatedFrom:[
    'data/game-registry-v2.json',
    'configuration/game-qa/game-profiles.json'
  ],
  references:profiles.references||[],
  summary:{
    gameCount:games.length,
    compliantCount:games.filter(game=>game.compliant).length,
    debtCount:games.reduce((sum,game)=>sum+game.debt.length,0),
    gamesWithDebt:games.filter(game=>!game.compliant).length
  },
  games
};

const text=JSON.stringify(report,null,2)+'\n';
if(check){
  if(!fs.existsSync(outputPath)){
    console.error(`${outputPath} is missing; run npm run games:profiles:report`);
    process.exit(1);
  }
  const current=fs.readFileSync(outputPath,'utf8').replace(/\r\n/g,'\n');
  if(current!==text.replace(/\r\n/g,'\n')){
    console.error(`${outputPath} is stale; run npm run games:profiles:report`);
    process.exit(1);
  }
  console.log(`Game profile compliance report current: ${report.summary.compliantCount}/${report.summary.gameCount} games have no tracked profile debt.`);
  process.exit(0);
}

fs.writeFileSync(outputPath,text);
console.log(`Wrote ${outputPath}: ${report.summary.compliantCount}/${report.summary.gameCount} games have no tracked profile debt; ${report.summary.debtCount} debt item(s).`);
