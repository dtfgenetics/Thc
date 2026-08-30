import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function lookup(id) {
  const result = spawnSync(process.execPath, ['scripts/game-status.mjs', '--id', id, '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

const external = lookup('weedopolis');
assert.equal(external.canonicalRepository, 'dtfgenetics/Weedopolis-strain-Edition');
assert.equal(external.publicRoute, '/games/weedopolis/');
assert.equal(external.productionSite, 'https://dtfseeds.com');

const local = lookup('high-life');
assert.equal(local.canonicalRepository, 'dtfgenetics/Thc');
assert.equal(local.publicRoute, '/games/high-life/');
assert.equal(local.packagedSourcePath, 'site/public-route-patch/games/high-life');
assert.ok(local.verificationCommand, 'local public game should expose its verification command');

console.log('Single-game ownership lookup contract OK');
