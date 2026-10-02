import assert from 'node:assert/strict';
import fs from 'node:fs';

const api=fs.readFileSync('site/public-route-patch/games/bud-or-bluff/api-v2.php','utf8');
const app=fs.readFileSync('site/public-route-patch/games/bud-or-bluff/app-v2.js','utf8');
const contract=JSON.parse(fs.readFileSync('games/bud-or-bluff/game.json','utf8'));

assert.equal(contract.protocolVersion,1);
assert.equal(contract.protocol.header,'X-DTF-Game-Protocol');
assert.match(api,/const BOB_PROTOCOL_VERSION = 1;/);
assert.match(api,/HTTP_X_DTF_GAME_PROTOCOL/);
assert.match(api,/Client protocol is incompatible with this room server\.'/);
assert.match(api,/X-DTF-Game-Protocol:/);
assert.match(api,/'protocolVersion'=>BOB_PROTOCOL_VERSION/);
assert.match(app,/const PROTOCOL_VERSION = 1;/);
assert.match(app,/'X-DTF-Game-Protocol':String\(PROTOCOL_VERSION\)/);
assert.match(app,/client is out of date/i);

console.log('Bud or Bluff protocol v1 contract OK');
