import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function run(files){
  const result=spawnSync(process.execPath,['scripts/plan-affected-games.mjs','--files',files,'--json'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
  return JSON.parse(result.stdout);
}

const highIq=run('games/high-iq/data/questions.json');
assert.ok(highIq.affected.some(game=>game.id==='high-iq'));

const shared=run('games/shared-platform/src/save.mjs');
assert.ok(shared.affected.length>0);
assert.ok(shared.affected.every(game=>game.reasons.includes('shared-platform-change')||game.reasons.includes('profile-contract-change')||game.reasons.includes('registry-change')));

const profiles=run('configuration/game-qa/game-profiles.json');
const registry=JSON.parse(readFileSync('data/game-registry-v2.json','utf8'));
assert.equal(profiles.affectedCount,registry.games.length);

console.log('affected game planner contract OK');
