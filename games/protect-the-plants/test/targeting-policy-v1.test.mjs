import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('site/public-route-patch/games/protect-the-plants');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const policy=read('targeting-policy-v1.js');
const enhancements=read('enhancements.js');
const targeting=read('targeting-v1.js');
const index=read('index.html');
const sw=read('sw.js');

for(const marker of [
  "const PREF_KEYS=['burnBudsUxV3','protectPlantsUxV2']",
  "const PREF_NAME='confirmShots'",
  'parsed[PREF_NAME]=false',
  "event.stopImmediatePropagation()",
  "window.BurnBudsSync.subscribe(removeLegacyControl,{immediate:false})",
  "window.BurnBudsTargetingPolicy='native-coarse-two-tap'",
  "input.closest('label')?.remove()"
]) assert.ok(policy.includes(marker),`Missing targeting policy marker: ${marker}`);

assert.ok(enhancements.includes('confirmShots'),'Legacy enhancement compatibility code must remain detectable until direct source cleanup.');
assert.ok(targeting.includes("const coarsePointer=()=>window.matchMedia?.('(pointer: coarse)').matches===true"));
assert.ok(targeting.includes('Tap once to aim. Tap the same cell again to fire.'));
assert.ok(index.indexOf('./targeting-policy-v1.js')>index.indexOf('./runtime-sync-v1.js'));
assert.ok(index.indexOf('./targeting-policy-v1.js')<index.indexOf('./enhancements.js'));
assert.ok(index.indexOf('./enhancements.js')<index.indexOf('./targeting-v1.js'));
assert.ok(sw.includes('ptp-shell-v7-burn-buds-targeting-policy-20260905'));
assert.ok(sw.includes('./targeting-policy-v1.js'));

console.log('Burn Buds targeting policy disables duplicate legacy shot confirmation while preserving native coarse-pointer two-tap targeting.');
