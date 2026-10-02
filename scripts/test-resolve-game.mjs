import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function resolve(name){
  const result=spawnSync(process.execPath,['scripts/resolve-game.mjs',name,'--json'],{
    cwd:process.cwd(),
    encoding:'utf8'
  });
  assert.equal(result.status,0,result.stderr||result.stdout);
  return JSON.parse(result.stdout);
}

const burn=resolve('Burn Buds');
assert.equal(burn.id,'protect-the-plants');
assert.equal(burn.requested,'Burn Buds');
assert.ok(burn.canonicalRepository);

const duck=resolve('duck race');
assert.equal(duck.id,'stoner-duck-race');
assert.equal(duck.overlayEligible,false);
assert.ok(duck.developmentLocations.some(location=>location.repository==='dtfgenetics/Dtf420'&&location.releasable===false));

const ganjumanji=resolve('ganjumanji');
assert.equal(ganjumanji.canonicalRepository,'dtfgenetics/GANJUMANJI-The-Lost-Grower-s-Temple');
assert.equal(ganjumanji.publicRoute,'/games/ganjumanji/');
assert.ok(ganjumanji.buildCommand);

console.log('canonical game resolver contract OK');
