#!/usr/bin/env node
import fs from 'node:fs';

const check=process.argv.includes('--check');
const registry=JSON.parse(fs.readFileSync('data/game-registry-v2.json','utf8'));
const profiles=JSON.parse(fs.readFileSync('configuration/game-qa/game-profiles.json','utf8'));
const outputPath='data/autonomous-playtest-work-queue.json';

const rendererWeight={dom:1,'svg-dom':1,hybrid:2,canvas2d:2,phaser:3,'react-dom':3,threejs:4};
const networkWeight={local:0,'share-code':1,'optional-realtime':3,'request-response-authoritative':4,'turn-authoritative':4,'realtime-authoritative':5};
const gameplayWeight={
  'casual-puzzle':0,'party-social':1,'trivia-knowledge':1,'daily-puzzle':2,'arcade-action':2,
  'card-strategy':2,'board-simulation':3,'campaign-rpg':3,'turn-multiplayer':4,'realtime-multiplayer':5
};
const releaseWeight={'public-unverified':0,'public-verified':0,packaged:0,'release-candidate':0,'vertical-slice':1,'playable-local':2,prototype:3,design:4};

const gameById=new Map((registry.games||[]).map(game=>[game.id,game]));
const items=[];
for(const [gameId,profile] of Object.entries(profiles.games||{})){
  if(profile.autonomousPlaytestProfile==='agent-ready') continue;
  const game=gameById.get(gameId);
  if(!game) continue;
  const effort=
    (rendererWeight[profile.rendererProfile] ?? 4)+
    (networkWeight[profile.networkProfile] ?? 5)+
    (gameplayWeight[profile.gameplayProfile] ?? 4);
  const releasePriority=releaseWeight[game.release?.status] ?? 5;
  const target=profile.autonomousPlaytestProfile==='planned' ? 'observable' :
    profile.autonomousPlaytestProfile==='observable' ? 'controllable' : 'agent-ready';
  items.push({
    gameId,
    title:game.title,
    currentProfile:profile.autonomousPlaytestProfile,
    nextTarget:target,
    estimatedEffortScore:effort,
    releasePriority,
    gameplayProfile:profile.gameplayProfile,
    rendererProfile:profile.rendererProfile,
    networkProfile:profile.networkProfile,
    canonicalRepository:game.production?.repository ?? null,
    sourcePaths:game.production?.sourcePaths ?? [],
    publicRoute:game.publicRoute ?? null,
    verificationCommands:game.verification?.testCommands ?? [],
    recommendedWork: target==='observable'
      ? 'Expose a versioned read-only structured state snapshot without hidden answer/card/authority data.'
      : target==='controllable'
        ? 'Add legal action methods that route through the same validated input/UI/gameplay paths used by players.'
        : 'Add telemetry, stall/soft-lock detection, executable agent-contract coverage, and promote to agent-ready.'
  });
}
items.sort((a,b)=>a.estimatedEffortScore-b.estimatedEffortScore || a.releasePriority-b.releasePriority || a.gameId.localeCompare(b.gameId));
items.forEach((item,index)=>{item.rank=index+1;});
const queue={
  schemaVersion:1,
  generatedFrom:['data/game-registry-v2.json','configuration/game-qa/game-profiles.json'],
  policy:{
    ordering:'Lowest estimated implementation effort first, then production/release proximity, then canonical game id.',
    noCheating:'Agent state must not expose hidden answer keys, unrevealed card identities, server secrets, or bypass-only state.',
    promotion:'Do not mark a game agent-ready until structured state, legal actions, telemetry/stall detection, executable agent tests, and game-specific release gates all pass.'
  },
  summary:{
    totalGames:Object.keys(profiles.games||{}).length,
    agentReady:Object.values(profiles.games||{}).filter(p=>p.autonomousPlaytestProfile==='agent-ready').length,
    remaining:items.length
  },
  nextRecommended:items.slice(0,5).map(item=>item.gameId),
  items
};
const text=JSON.stringify(queue,null,2)+'\n';
if(check){
  if(!fs.existsSync(outputPath)){
    console.error(`${outputPath} is missing; run npm run games:agents:queue`);
    process.exit(1);
  }
  const current=fs.readFileSync(outputPath,'utf8').replace(/\r\n/g,'\n');
  if(current!==text.replace(/\r\n/g,'\n')){
    console.error(`${outputPath} is stale; run npm run games:agents:queue`);
    process.exit(1);
  }
  console.log(`Autonomous playtest queue current: ${queue.summary.agentReady} agent-ready, ${queue.summary.remaining} remaining. Next: ${queue.nextRecommended.join(', ')}`);
  process.exit(0);
}
fs.writeFileSync(outputPath,text);
console.log(`Wrote ${outputPath}: ${queue.summary.agentReady} agent-ready, ${queue.summary.remaining} remaining. Next: ${queue.nextRecommended.join(', ')}`);
