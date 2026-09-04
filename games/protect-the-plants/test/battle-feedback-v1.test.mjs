import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('site/public-route-patch/games/protect-the-plants/battle-feedback-v1.js','utf8');
const css=fs.readFileSync('site/public-route-patch/games/protect-the-plants/battle-feedback-v1.css','utf8');
const index=fs.readFileSync('site/public-route-patch/games/protect-the-plants/index.html','utf8');
const sw=fs.readFileSync('site/public-route-patch/games/protect-the-plants/sw.js','utf8');

for(const marker of [
  "state.lastEvent.type!=='scout'",
  "cardByTitle(mine?'Fire on Opponent':'Your Stash')",
  'burn-latest-shot','burn-latest-hit','burn-latest-miss','burn-primary-board','burn-secondary-board','burn-hit-cell','burn-miss-cell','requestAnimationFrame(sync)'
]) assert.ok(js.includes(marker),`Missing battle feedback behavior marker: ${marker}`);

assert.ok(!js.includes('fetch('),'Battle feedback must not bypass the server-authoritative multiplayer API.');
assert.ok(!js.includes("api('fire'"),'Battle feedback must not submit shots.');
assert.ok(css.includes('.cell.burn-hit-cell'),'Hit-cell styling missing.');
assert.ok(css.includes('.cell.burn-miss-cell'),'Miss-cell styling missing.');
assert.ok(css.includes('.cell.burn-latest-shot'),'Latest-shot styling missing.');
assert.ok(css.includes('@media(max-width:720px)'),'Mobile battle feedback styling missing.');
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'),'Reduced-motion battle feedback missing.');
assert.ok(index.includes('./battle-feedback-v1.css'),'Burn Buds page must load battle-feedback CSS.');
assert.ok(index.includes('./battle-feedback-v1.js'),'Burn Buds page must load battle-feedback JavaScript.');
assert.ok(index.indexOf('./battle-feedback-v1.js')>index.indexOf('./gameplay-v3.js'),'Battle feedback must load after gameplay-v3.');
assert.ok(sw.includes('./battle-feedback-v1.css'),'Service worker must cache battle-feedback CSS.');
assert.ok(sw.includes('./battle-feedback-v1.js'),'Service worker must cache battle-feedback JavaScript.');

console.log('Burn Buds battle feedback contract passed.');
