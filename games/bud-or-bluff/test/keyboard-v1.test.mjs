import assert from 'node:assert/strict';
import fs from 'node:fs';

const file='site/public-route-patch/games/bud-or-bluff/keyboard-v1.js';
const source=fs.readFileSync(file,'utf8');

for(const marker of [
  "element.closest('.hidden')",
  "getComputedStyle(element)",
  "event.repeat",
  "event.altKey",
  "event.ctrlKey",
  "event.metaKey",
  "matches('input,textarea,select,button')",
  "visible(bud)",
  "visible(bluff)",
  "visible(doubleWrap)"
]){
  assert.ok(source.includes(marker),`Missing keyboard safety marker: ${marker}`);
}

assert.ok(source.includes("event.key==='1'"),'BUD shortcut missing');
assert.ok(source.includes("event.key==='2'"),'BLUFF shortcut missing');
assert.ok(source.includes("event.key.toLowerCase()==='d'"),'Double Hit shortcut missing');
assert.ok(!source.includes("!element.classList.contains('hidden')"),'Visibility must account for hidden ancestors, not only the control itself');

console.log('Bud or Bluff keyboard shortcut visibility regression passed.');
