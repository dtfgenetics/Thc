import assert from 'node:assert/strict';
import fs from 'node:fs';

const jsPath='site/public-route-patch/games/protect-the-plants/targeting-v1.js';
const cssPath='site/public-route-patch/games/protect-the-plants/targeting-v1.css';
const indexPath='site/public-route-patch/games/protect-the-plants/index.html';

const js=fs.readFileSync(jsPath,'utf8');
const css=fs.readFileSync(cssPath,'utf8');
const index=fs.readFileSync(indexPath,'utf8');

for(const marker of [
  'burn-target-readout',
  'aria-keyshortcuts',
  "['ArrowUp','ArrowDown','ArrowLeft','ArrowRight']",
  'availableCells(card)',
  'cell.tabIndex=-1',
  'next.tabIndex=0',
  "state.turnPlayerId===state.me?.id",
  "event?.type==='scout'",
  'let firePending=false',
  'function setFirePending(next)',
  "document.body.classList.toggle('burn-fire-pending',firePending)",
  "cell.setAttribute('aria-busy',String(firePending))",
  'event.stopImmediatePropagation()',
  "if(action==='fire')setFirePending(true)",
  "finally{if(action==='fire')setFirePending(false)}"
]){
  assert.ok(js.includes(marker),`Missing targeting behavior marker: ${marker}`);
}

assert.ok(!js.includes('fetch('),'Targeting helper must not bypass the server-authoritative game API.');
assert.ok(!js.includes("api('fire'"),'Targeting helper must not submit shots directly.');
assert.ok(css.includes('.burn-target-readout'),'Target readout styling missing.');
assert.ok(css.includes(':focus-visible'),'Keyboard focus styling missing.');
assert.ok(index.includes('./targeting-v1.css'),'Burn Buds page must load targeting CSS.');
assert.ok(index.includes('./targeting-v1.js'),'Burn Buds page must load targeting JavaScript.');
assert.ok(index.indexOf('./targeting-v1.js')>index.indexOf('./app.js'),'Targeting helper must load after the core game runtime.');

console.log('Burn Buds targeting UX contract passed.');
