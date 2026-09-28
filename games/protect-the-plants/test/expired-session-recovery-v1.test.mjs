import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('site/public-route-patch/games/protect-the-plants/app.js','utf8');

assert.match(
  source,
  /if\(\/expired\|not found\|session\/i\.test\(e\.message\)\)\{stopPoll\(\);identity=\{\.\.\.identity,playerId:'',token:'',code:''\};save\(\);history\.replaceState\(\{\},'',location\.pathname\);/,
  'expired or invalid multiplayer sessions must clear only room credentials and remove the stale room URL'
);

assert.match(
  source,
  /Return to the lobby to start or join a new battle\./,
  'expired sessions must explain the recovery path'
);

assert.match(
  source,
  /await renderLobby\(\)/,
  'expired sessions must recover into a usable lobby instead of leaving a dead battle screen'
);

console.log('Burn Buds expired-session recovery contract passed.');
