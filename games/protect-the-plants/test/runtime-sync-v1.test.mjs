import assert from 'node:assert/strict';
import fs from 'node:fs';

const root='site/public-route-patch/games/protect-the-plants';
const read=file=>fs.readFileSync(`${root}/${file}`,'utf8');
const runtime=read('runtime-sync-v1.js');
const index=read('index.html');
const sw=read('sw.js');
const helpers=['battle-feedback-v1.js','combat-a11y-v1.js','placement-v1.js','targeting-v1.js','gameplay-v3.js'];

assert.ok(runtime.includes('window.BurnBudsSync=Object.freeze({request,subscribe})'),'Shared Burn Buds sync API missing.');
assert.equal((runtime.match(/new MutationObserver/g)||[]).length,1,'Shared sync runtime should own exactly one MutationObserver.');
for(const marker of ["document.addEventListener('visibilitychange'","window.addEventListener('online'","window.addEventListener('resize'"]){
  assert.ok(runtime.includes(marker),`Shared sync runtime missing lifecycle marker: ${marker}`);
}
assert.ok(index.includes('./runtime-sync-v1.js'),'Production page must load shared sync runtime.');
assert.ok(index.indexOf('./runtime-sync-v1.js')>index.indexOf('./app.js'),'Shared sync runtime must load after core app.');
assert.ok(index.indexOf('./runtime-sync-v1.js')<index.indexOf('./gameplay-v3.js'),'Shared sync runtime must load before gameplay helpers.');
assert.ok(sw.includes('./runtime-sync-v1.js'),'Service worker must cache shared sync runtime.');
assert.ok(sw.includes('ptp-shell-v7-burn-buds-targeting-policy-20260905'),'Service worker cache version must identify targeting-policy release.');

for(const file of helpers){
  const text=read(file);
  assert.ok(text.includes('BurnBudsSync'),`${file} must subscribe to shared sync.`);
  assert.ok(!text.includes('new MutationObserver'),`${file} must not own a DOM MutationObserver.`);
}

assert.ok(read('gameplay-v3.js').includes("document.addEventListener('visibilitychange',restartPresencePolling)"),'Presence polling lifecycle must remain independent from render sync.');
assert.ok(read('targeting-v1.js').includes("const coarsePointer=()=>window.matchMedia?.('(pointer: coarse)').matches===true"),'Coarse-pointer targeting contract must remain intact.');
assert.ok(read('targeting-v1.js').includes("if(coarsePointer())"),'Two-step coarse-pointer targeting behavior must remain intact.');

console.log('Burn Buds shared render-sync contract passed.');
