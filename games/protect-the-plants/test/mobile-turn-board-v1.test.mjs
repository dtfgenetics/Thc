import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('site/public-route-patch/games/protect-the-plants/app.js','utf8');

assert.match(
  source,
  /mobileBoard='mine',lastMobileTurnKey=''/,
  'mobile battle state must track the last automatic turn selection'
);

assert.match(
  source,
  /function syncMobileBoardForState\(\)\{if\(!state\?\.me\)return;const key=`\$\{state\.status\}:\$\{state\.turnPlayerId\|\|''\}`;if\(key===lastMobileTurnKey\)return;/,
  'automatic board switching must run only when the game phase or turn owner changes'
);

assert.match(
  source,
  /if\(state\.status==='placement'\)mobileBoard='mine';else if\(state\.status==='playing'\)mobileBoard=state\.turnPlayerId===state\.me\.id\?'enemy':'mine'/,
  'placement must show the stash while an active player turn should expose the firing board'
);

assert.match(
  source,
  /function renderGame\(\)\{syncMobileBoardForState\(\);/,
  'rendering must synchronize the mobile board before composing the visible battle view'
);

console.log('Burn Buds mobile turn-board transition contract passed.');
