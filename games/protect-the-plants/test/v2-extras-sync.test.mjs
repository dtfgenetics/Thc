import assert from 'node:assert/strict';
import fs from 'node:fs';

const root='site/public-route-patch/games/protect-the-plants';
const extras=fs.readFileSync(`${root}/v2-extras.js`,'utf8');
const runtime=fs.readFileSync(`${root}/runtime-sync-v1.js`,'utf8');
const index=fs.readFileSync(`${root}/index.html`,'utf8');

assert.ok(extras.includes("const HISTORY_KEY='burnBudsMatchHistoryV3'"),'Burn Buds match history key missing.');
assert.ok(extras.includes("const LEGACY_HISTORY_KEY='ptpMatchHistoryV2'"),'Legacy history migration key missing.');
assert.ok(extras.includes('function installAdaptivePolling()'),'Adaptive polling integration missing.');
assert.ok(extras.includes("document.addEventListener('visibilitychange'"),'Adaptive polling visibility lifecycle missing.');
assert.ok(extras.includes("window.addEventListener('online'"),'Adaptive polling online refresh missing.');
assert.ok(extras.includes('data-ptp-quick'),'Quick chat integration missing.');
assert.ok(extras.includes('data-ptp-extra="share-result"'),'Result sharing integration missing.');
assert.ok(extras.includes("navigator.serviceWorker.register('./sw.js')"),'Service worker registration missing.');
assert.ok(extras.includes('BurnBudsSync.subscribe(enhance'),'Extras must subscribe to shared render sync.');
assert.ok(!extras.includes('new MutationObserver'),'Extras must not create a dedicated MutationObserver.');
assert.ok(runtime.includes('window.BurnBudsSync=Object.freeze({request,subscribe})'),'Shared sync runtime missing.');
assert.ok(index.indexOf('./runtime-sync-v1.js')<index.indexOf('./v2-extras.js'),'Shared sync runtime must load before v2 extras.');

console.log('Burn Buds v2 extras shared-sync contract passed.');
