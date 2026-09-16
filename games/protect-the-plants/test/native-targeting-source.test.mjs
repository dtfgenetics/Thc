import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('site/public-route-patch/games/protect-the-plants');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const enhancements=read('enhancements.js');
const targeting=read('targeting-v1.js');
const index=read('index.html');
const sw=read('sw.js');
const CURRENT_CACHE='ptp-shell-v10-burn-buds-v6-gameplay-focus-20260916';

for(const forbidden of ['confirmShots','armedShotKey','armedShotUntil','ptp-shot-armed','Confirm firing taps']) assert.ok(!enhancements.includes(forbidden),'Legacy shot confirmation source remains: '+forbidden);
assert.ok(!fs.existsSync(path.join(root,'targeting-policy-v1.js')),'Temporary targeting policy guard must be retired.');
assert.ok(!index.includes('./targeting-policy-v1.js'),'Production page must not load retired targeting policy guard.');
assert.ok(!sw.includes('./targeting-policy-v1.js'),'Service worker must not cache retired targeting policy guard.');
assert.ok(sw.includes(CURRENT_CACHE),`Service worker must expose current V6 gameplay-focus cache: ${CURRENT_CACHE}`);
for(const marker of ["const coarsePointer=()=>window.matchMedia?.('(pointer: coarse)').matches===true",'Tap once to aim. Tap the same cell again to fire.','target-armed','aria-pressed']) assert.ok(targeting.includes(marker),'Missing native targeting marker: '+marker);
console.log('Burn Buds native targeting source, V10 cache, and legacy confirmShots removal contract passed.');
