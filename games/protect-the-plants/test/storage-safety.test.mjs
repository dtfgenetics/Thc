import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = 'site/public-route-patch/games/protect-the-plants';
const app = fs.readFileSync(`${root}/app.js`, 'utf8');
const enhancements = fs.readFileSync(`${root}/enhancements.js`, 'utf8');

for (const marker of [
  'function storageGet(key)',
  'function storageSet(key,value)',
  'function parseStoredSession(raw)',
  'const currentSession=storageGet(SESSION_KEY)',
  'const saved=parseStoredSession(currentSession||legacySession)',
  'const save=()=>storageSet(SESSION_KEY,JSON.stringify(identity))',
  'async function copyText(value)',
  "document.execCommand?.('copy')===true",
  "const copied=await copyText(text)"
]) {
  assert.ok(app.includes(marker), `Burn Buds storage/copy safety marker missing: ${marker}`);
}

assert.ok(!app.includes("const legacySession=localStorage.getItem(LEGACY_SESSION_KEY)"), 'Burn Buds must not touch localStorage unguarded during bootstrap');
assert.ok(!app.includes("const saved=JSON.parse(localStorage.getItem(SESSION_KEY)"), 'Burn Buds must not parse saved session JSON without corruption fallback');
assert.ok(enhancements.includes("globalThis.localStorage?.setItem(PREF_KEY, JSON.stringify(prefs))"), 'Burn Buds preference saves must tolerate unavailable storage');

console.log('Burn Buds restricted-storage, corrupt-session, and clipboard fallback contracts passed.');
