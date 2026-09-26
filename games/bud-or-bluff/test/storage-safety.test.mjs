import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = 'site/public-route-patch/games/bud-or-bluff';
const app = fs.readFileSync(`${root}/app-v2.js`, 'utf8');
const prefs = fs.readFileSync(`${root}/player-pref-v1.js`, 'utf8');

for (const marker of [
  'function storageGet(key)',
  'function storageSet(key,value)',
  'function storageRemove(key)',
  "let soundOn = storageGet(SOUND_KEY) !== 'off'",
  'storageSet(SESSION_KEY,JSON.stringify(data))',
  'storageRemove(SESSION_KEY)',
  "storageSet(SOUND_KEY,soundOn?'on':'off')"
]) {
  assert.ok(app.includes(marker), `Bud or Bluff storage safety marker missing: ${marker}`);
}

assert.ok(!app.includes("let soundOn = localStorage.getItem(SOUND_KEY)"), 'sound preference must not crash startup when storage is blocked');
assert.ok(!app.includes("localStorage.setItem(SESSION_KEY"), 'session writes must be storage-safe');
assert.ok(!app.includes("localStorage.removeItem(SESSION_KEY"), 'session removal must be storage-safe');
assert.ok(prefs.includes('globalThis.localStorage?.getItem(PLAYER_NAME_KEY)'), 'player-name reads must tolerate unavailable storage');
assert.ok(prefs.includes('globalThis.localStorage?.setItem(PLAYER_NAME_KEY, name)'), 'player-name writes must tolerate unavailable storage');

console.log('Bud or Bluff restricted-storage startup and player preference contracts passed.');
