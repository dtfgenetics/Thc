import fs from 'node:fs';
import assert from 'node:assert/strict';

const root='site/public-route-patch/games/protect-the-plants';
const html=fs.readFileSync(`${root}/index.html`,'utf8');
const css=fs.readFileSync(`${root}/gamefeel-v1.css`,'utf8');
const sw=fs.readFileSync(`${root}/sw.js`,'utf8');

assert.match(html,/gamefeel-v1\.css/,'game-feel stylesheet must load');
assert.match(css,/burn-primary-board/,'active battle board must receive primary emphasis');
assert.match(css,/burn-secondary-board/,'secondary board must be visually de-emphasized');
assert.match(css,/burn-armed-target/,'armed mobile target must remain obvious');
assert.match(css,/@media\(max-width:900px\)/,'mobile battle layout must be explicit');
assert.match(css,/prefers-reduced-motion/,'game-feel motion must respect reduced motion');
assert.match(sw,/ptp-shell-v9-burn-buds-gamefeel-20260906/,'service-worker cache must roll for UI release');
assert.match(sw,/\.\/gamefeel-v1\.css/,'game-feel layer must be available offline');
console.log('Burn Buds game-feel UI contract passed.');
