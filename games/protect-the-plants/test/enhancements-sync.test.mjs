import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('site/public-route-patch/games/protect-the-plants');
const text=fs.readFileSync(path.join(root,'enhancements.js'),'utf8');

assert.ok(text.includes('BurnBudsSync.subscribe(queueEnhance'),'enhancements.js must subscribe to shared Burn Buds render sync.');
assert.ok(!text.includes('new MutationObserver'),'enhancements.js must not own a DOM MutationObserver.');

for(const marker of [
  "const PREF_KEY = 'burnBudsUxV3'",
  'function sfx(name)',
  'function vibrate(pattern)',
  'function markNetwork(next)',
  'function ensureDialog()',
  'function ensureBattleTools()',
  'function ensurePlacementTools()',
  'function ensureRematch()',
  'async function shareInvite()',
  'async function toggleFullscreen()',
  'async function requestRematch()',
  'const originalApi = api',
  'const originalRenderGame = renderGame',
  'const originalRenderLobby = renderLobby',
  "window.addEventListener('online'",
  "window.addEventListener('offline'",
  "document.addEventListener('visibilitychange'"
]) assert.ok(text.includes(marker),`Enhancements behavior marker missing after sync migration: ${marker}`);

console.log('Burn Buds enhancements shared-sync contract passed.');
